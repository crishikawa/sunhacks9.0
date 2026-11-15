import { deskBrief, moodFor, parseChat, sampleReply, TICK_PERSONA, type ChatMessage, type DeskContext } from "@/lib/chat";
import { assertDeskSecret, DeskAuthError } from "@/lib/desk-secret";
import { MODEL, apiError, readJson, textFromResponses } from "@/lib/grok";
import { beginRequest, errorMessage, json } from "@/lib/http";
import { getMarket, type Quote } from "@/lib/prices";
import { getPortfolio, listSignals, listTrades, listWatchlist } from "@/lib/repository";

async function loadDesk(): Promise<DeskContext> {
  const [watchlist, signals, trades, portfolio] = await Promise.all([
    listWatchlist(),
    listSignals(),
    listTrades(),
    getPortfolio(),
  ]);
  let market: Record<string, Quote> = {};
  try {
    market = await getMarket(watchlist);
  } catch {
    // Price feed busy (CoinGecko 429): Tick still answers from signals and holdings.
  }
  return {
    coins: watchlist.map((asset) => ({
      symbol: asset.symbol,
      name: asset.name,
      price: market[asset.symbol]?.usd ?? null,
      change24h: market[asset.symbol]?.change24h ?? null,
      held: portfolio.holdings[asset.symbol] ?? 0,
      signal: signals.find((signal) => signal.ticker === asset.symbol) ?? null,
    })),
    cash: portfolio.cash_balance,
    trades,
  };
}

async function askGrok(apiKey: string, messages: ChatMessage[], brief: string): Promise<string> {
  const system = `${TICK_PERSONA}\n\n${brief}`;
  const headers = { authorization: `Bearer ${apiKey}`, "content-type": "application/json" };
  try {
    // Responses API can search X and the web for fresh context.
    const response = await fetch("https://api.x.ai/v1/responses", {
      method: "POST",
      headers,
      body: JSON.stringify({
        model: MODEL,
        input: [{ role: "system", content: system }, ...messages],
        tools: [{ type: "x_search" }, { type: "web_search" }],
        temperature: 0.4,
      }),
      signal: AbortSignal.timeout(60_000),
    });
    const body = await readJson(response);
    if (!response.ok) throw new Error(apiError("Responses", response.status, body));
    const text = textFromResponses(body).trim();
    if (!text) throw new Error("Responses API returned no text");
    return text;
  } catch {
    // Fallback without search: Tick answers from desk data only.
    const response = await fetch("https://api.x.ai/v1/chat/completions", {
      method: "POST",
      headers,
      body: JSON.stringify({
        model: MODEL,
        messages: [
          { role: "system", content: `${system}\nLive search is unavailable for this answer; do not claim to have checked X.` },
          ...messages,
        ],
        temperature: 0.4,
      }),
      signal: AbortSignal.timeout(45_000),
    });
    const body = await readJson(response);
    if (!response.ok) throw new Error(apiError("Chat completions", response.status, body));
    const content = body.choices?.[0]?.message?.content;
    if (typeof content !== "string" || !content.trim()) throw new Error("Grok returned an empty answer");
    return content.trim();
  }
}

export async function POST(request: Request) {
  await beginRequest();
  try {
    assertDeskSecret(request.headers.get("x-desk-secret"), {
      secret: process.env.DESK_ADMIN_SECRET,
      production: process.env.VERCEL_ENV === "production",
    });
  } catch (error) {
    return json({ error: error instanceof DeskAuthError ? "Unauthorized" : errorMessage(error) }, 401);
  }

  let messages: ChatMessage[];
  try {
    messages = parseChat(await request.json());
  } catch (error) {
    return json({ error: errorMessage(error) }, 400);
  }

  try {
    const desk = await loadDesk();
    const question = messages[messages.length - 1].content;
    const mood = moodFor(question, desk);
    const apiKey = process.env.XAI_API_KEY;
    if (!apiKey) return json({ reply: sampleReply(question, desk), source: "sample", mood });
    const reply = (await askGrok(apiKey, messages, deskBrief(desk))).replace(/\*\*(.+?)\*\*/g, "$1");
    return json({ reply, source: "grok", mood });
  } catch (error) {
    return json({ error: `Tick couldn't answer: ${errorMessage(error)}` }, 502);
  }
}
