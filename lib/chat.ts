import type { SentimentSignal, Trade } from "../types/database";

export type ChatMessage = { role: "user" | "assistant"; content: string };
export type ChatMood = "bull" | "bear" | "neutral";

export type DeskCoin = {
  symbol: string;
  name: string;
  price: number | null;
  change24h: number | null;
  held: number;
  signal: SentimentSignal | null;
};

export type DeskContext = {
  coins: DeskCoin[];
  cash: number;
  trades: Trade[];
};

const MAX_MESSAGES = 12;
const MAX_CHARS = 1500;

export const TICK_PERSONA = [
  "You are Tick, the mascot and resident analyst of TickSense, a paper-trading desk that trades crypto on Grok sentiment from X and the news.",
  "Voice: calm, sharp, friendly, a little dry. Talk like a good analyst friend, not a hype account. First person.",
  "Use DESK DATA for prices, 24h moves, the desk's latest sentiment reads, holdings and trades. Quote those numbers exactly; never invent prices.",
  "Use live X and web search for fresh news and what people are saying, and say when a point comes from posts on X.",
  "TickSense covers crypto, not stocks. If asked about a stock, say the desk tracks crypto and offer the closest crypto angle.",
  "Never promise returns or tell someone to buy or sell with real money. Everything here is paper trading; mention it is not financial advice only when asked what to buy or sell.",
  "Answer in under 120 words, plain text. No markdown headings, bold or tables; short paragraphs or simple '- ' bullets are fine.",
].join(" ");

export function parseChat(input: unknown): ChatMessage[] {
  const body = input && typeof input === "object" ? (input as Record<string, unknown>) : {};
  if (!Array.isArray(body.messages)) throw new Error("messages must be an array");
  const messages: ChatMessage[] = [];
  for (const item of body.messages.slice(-MAX_MESSAGES)) {
    const row = item && typeof item === "object" ? (item as Record<string, unknown>) : {};
    if (row.role !== "user" && row.role !== "assistant") throw new Error("role must be user or assistant");
    const content = typeof row.content === "string" ? row.content.trim() : "";
    if (!content) throw new Error("message content is empty");
    if (content.length > MAX_CHARS) throw new Error(`messages are limited to ${MAX_CHARS} characters`);
    messages.push({ role: row.role, content });
  }
  if (messages.at(-1)?.role !== "user") throw new Error("the last message must be from the user");
  return messages;
}

const usd = (value: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: value >= 100 ? 2 : value >= 1 ? 4 : 8,
  }).format(value);

const pct = (value: number) => `${value >= 0 ? "+" : "−"}${Math.abs(value).toFixed(2)}%`;
const score = (value: number) => `${value >= 0 ? "+" : "−"}${Math.abs(value).toFixed(2)}`;

export function deskBrief(ctx: DeskContext): string {
  const lines = ["DESK DATA (live, paper book):"];
  for (const coin of ctx.coins) {
    const parts = [`${coin.symbol} (${coin.name})`];
    parts.push(coin.price != null ? `price ${usd(coin.price)}` : "price unavailable");
    if (coin.change24h != null) parts.push(`24h ${pct(coin.change24h)}`);
    if (coin.signal) {
      parts.push(
        `latest read ${score(coin.signal.sentiment_score)} ${coin.signal.recommended_action} at ${Math.round(coin.signal.confidence * 100)}% confidence (${coin.signal.created_at}): ${coin.signal.summary_catalyst}`,
      );
    } else {
      parts.push("no read yet");
    }
    if (coin.held > 0) parts.push(`holding ${coin.held} ${coin.symbol}`);
    lines.push(`- ${parts.join("; ")}`);
  }
  lines.push(`- cash ${usd(ctx.cash)}`);
  for (const trade of ctx.trades.slice(0, 5)) {
    lines.push(`- trade: ${trade.action} ${usd(trade.amount_usd)} of ${trade.ticker} at ${usd(trade.price_at_execution)} (${trade.created_at})`);
  }
  return lines.join("\n");
}

export function mentionedCoins(text: string, coins: DeskCoin[]): DeskCoin[] {
  const lower = text.toLowerCase();
  return coins.filter((coin) => {
    const symbol = new RegExp(`(^|[^a-z0-9$])\\$?${coin.symbol.toLowerCase()}([^a-z0-9]|$)`);
    return symbol.test(lower) || lower.includes(coin.name.toLowerCase());
  });
}

export function moodFor(text: string, ctx: DeskContext): ChatMood {
  const coin = mentionedCoins(text, ctx.coins)[0];
  const value = coin?.signal?.sentiment_score;
  if (value == null) return "neutral";
  return value > 0.15 ? "bull" : value < -0.15 ? "bear" : "neutral";
}

/** Tick's answer from desk data alone, used until an xAI key is configured. */
export function sampleReply(question: string, ctx: DeskContext): string {
  const coins = mentionedCoins(question, ctx.coins).slice(0, 2);
  const lower = question.toLowerCase();

  if (coins.length === 0 && /\bstocks?\b|\bshares?\b|nasdaq|s&p/.test(lower)) {
    return "TickSense tracks crypto, not stocks. Add a coin from the search bar and I'll follow it for you.";
  }

  if (coins.length === 0 && /portfolio|holding|my book|how am i|p&l|pnl|cash/.test(lower)) {
    const held = ctx.coins.filter((coin) => coin.held > 0);
    const worth = held.reduce((sum, coin) => sum + (coin.price != null ? coin.held * coin.price : 0), 0);
    const parts = held.map(
      (coin) => `${coin.held} ${coin.symbol}${coin.price != null ? ` (${usd(coin.held * coin.price)})` : ""}`,
    );
    return [
      `You have ${usd(ctx.cash)} in cash${held.length ? ` and ${parts.join(", ")}` : " and no coins yet"}.`,
      held.length ? `That's about ${usd(ctx.cash + worth)} in total.` : "Run a scan and the desk will trade by your rules.",
    ].join(" ");
  }

  if (coins.length === 0) {
    const moves = ctx.coins.filter((coin) => coin.change24h != null);
    const best = moves.sort((a, b) => (b.change24h ?? 0) - (a.change24h ?? 0))[0];
    const strongest = ctx.coins
      .filter((coin) => coin.signal)
      .sort((a, b) => Math.abs(b.signal!.sentiment_score) - Math.abs(a.signal!.sentiment_score))[0];
    const lines = [];
    if (best) lines.push(`Best mover on your list today is ${best.name}, ${pct(best.change24h!)} in 24 hours.`);
    if (strongest?.signal) {
      lines.push(
        `My strongest read is ${strongest.symbol} at ${score(strongest.signal.sentiment_score)}: ${strongest.signal.summary_catalyst}`,
      );
    }
    lines.push("Ask about a specific coin for its price, 24h move, and my latest read.");
    return lines.join(" ");
  }

  const lines = coins.map((coin) => {
    const bits = [];
    bits.push(
      coin.price != null
        ? `${coin.name} is at ${usd(coin.price)}${coin.change24h != null ? `, ${pct(coin.change24h)} in 24 hours` : ""}.`
        : `I don't have a live price for ${coin.name} right now.`,
    );
    if (coin.signal) {
      bits.push(
        `My last read was ${score(coin.signal.sentiment_score)} with ${Math.round(coin.signal.confidence * 100)}% confidence: ${coin.signal.summary_catalyst}`,
      );
    } else {
      bits.push(`There's no sentiment read on ${coin.symbol} yet. Run a scan to get one.`);
    }
    if (coin.held > 0) {
      bits.push(`You hold ${coin.held} ${coin.symbol}${coin.price != null ? `, worth ${usd(coin.held * coin.price)}` : ""}.`);
    }
    return bits.join(" ");
  });
  return lines.join("\n\n");
}
