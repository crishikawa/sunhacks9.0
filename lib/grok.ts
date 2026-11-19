import type { Asset, SentimentSource, SignalDraft, Ticker } from "@/types/database";
import { isRecommendedAction } from "@/lib/trading";
import { xaiApiKey } from "@/lib/demo";

export const MODEL = "grok-4.3";

const SAMPLE_PATTERNS: Array<Pick<SignalDraft, "sentiment_score" | "confidence" | "recommended_action" | "summary_catalyst">> = [
  {
    sentiment_score: 0.86,
    confidence: 0.91,
    recommended_action: "BUY",
    summary_catalyst:
      "Sample mode: strong bid and positive headlines. This clears the default buy threshold and confidence gate.",
  },
  {
    sentiment_score: 0.78,
    confidence: 0.88,
    recommended_action: "BUY",
    summary_catalyst:
      "Sample mode: constructive flow across news and social posts. Confidence clears the default minimum.",
  },
  {
    sentiment_score: 0.15,
    confidence: 0.55,
    recommended_action: "HOLD",
    summary_catalyst:
      "Sample mode: mixed tape. Confidence stays under the default minimum, so no order is sent.",
  },
  {
    sentiment_score: -0.84,
    confidence: 0.9,
    recommended_action: "SELL",
    summary_catalyst:
      "Sample mode: sharp risk-off turn. A sale is sent when holdings cover the configured trade size.",
  },
  {
    sentiment_score: -0.35,
    confidence: 0.8,
    recommended_action: "SELL",
    summary_catalyst:
      "Sample mode: mild weakness. The score is above the default sell threshold, so the order is skipped.",
  },
  {
    sentiment_score: 0.92,
    confidence: 0.4,
    recommended_action: "BUY",
    summary_catalyst:
      "Sample mode: bullish headline with low confidence. The confidence gate blocks the trade.",
  },
];

const sampleState = globalThis as { __sampleScan?: number };

export async function analyzeTicker(asset: Asset): Promise<{ draft: SignalDraft; source: SentimentSource }> {
  const ticker = asset.symbol;
  const apiKey = xaiApiKey();
  if (!apiKey) return { draft: sampleDraft(ticker), source: "sample" };

  const prompt = [
    `Analyze real-time X posts and news sentiment for the cryptocurrency ${asset.name} (ticker ${ticker}, CoinGecko id ${asset.coingecko_id}).`,
    "Use current information. Return one JSON object and no other text.",
    `Shape: {"ticker":"${ticker}","sentiment_score":-1..1,"confidence":0..1,"summary_catalyst":"one or two sentences","recommended_action":"BUY|SELL|HOLD"}.`,
    "BUY only for a clear bullish catalyst, SELL only for a clear bearish catalyst, otherwise HOLD.",
    `The ticker field must be ${ticker}.`,
  ].join(" ");

  try {
    const text = await callResponses(apiKey, prompt);
    return { draft: parseDraft(text, ticker), source: "grok" };
  } catch (searchError) {
    try {
      const text = await callChatCompletions(apiKey, prompt);
      return { draft: parseDraft(text, ticker), source: "grok" };
    } catch (chatError) {
      const searchMessage = searchError instanceof Error ? searchError.message : "search request failed";
      const chatMessage = chatError instanceof Error ? chatError.message : "chat request failed";
      throw new Error(`Grok scan failed. Responses API: ${searchMessage}. Chat completions: ${chatMessage}`);
    }
  }
}

function sampleDraft(ticker: Ticker): SignalDraft {
  const index = sampleState.__sampleScan ?? 0;
  sampleState.__sampleScan = index + 1;
  const pattern = SAMPLE_PATTERNS[index % SAMPLE_PATTERNS.length];
  return { ticker, ...pattern };
}

async function callResponses(apiKey: string, prompt: string): Promise<string> {
  const response = await fetch("https://api.x.ai/v1/responses", {
    method: "POST",
    headers: {
      authorization: `Bearer ${apiKey}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: MODEL,
      input: [{ role: "user", content: prompt }],
      tools: [{ type: "web_search" }, { type: "x_search" }],
      temperature: 0.2,
    }),
    signal: AbortSignal.timeout(60_000),
  });
  const body = await readJson(response);
  if (!response.ok) {
    throw new Error(apiError("Responses", response.status, body));
  }
  const text = textFromResponses(body);
  if (!text) throw new Error("Responses API returned no text");
  return text;
}

async function callChatCompletions(apiKey: string, prompt: string): Promise<string> {
  const response = await fetch("https://api.x.ai/v1/chat/completions", {
    method: "POST",
    headers: {
      authorization: `Bearer ${apiKey}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: MODEL,
      messages: [
        {
          role: "system",
          content: "You are a crypto sentiment analyst. Reply with one JSON object and nothing else.",
        },
        { role: "user", content: prompt },
      ],
      response_format: { type: "json_object" },
      temperature: 0.2,
    }),
    signal: AbortSignal.timeout(45_000),
  });
  const body = await readJson(response);
  if (!response.ok) {
    throw new Error(apiError("Chat completions", response.status, body));
  }
  const content = body.choices?.[0]?.message?.content;
  if (typeof content !== "string" || !content.trim()) {
    throw new Error("Chat completions returned no message content");
  }
  return content;
}

type JsonRecord = Record<string, unknown> & {
  choices?: Array<{ message?: { content?: string } }>;
  output_text?: unknown;
  output?: Array<{ type?: string; content?: unknown }>;
  error?: { message?: string } | string;
};

export async function readJson(response: Response): Promise<JsonRecord> {
  const text = await response.text();
  if (!text) return {};
  try {
    return JSON.parse(text) as JsonRecord;
  } catch {
    return { error: text.slice(0, 300) };
  }
}

export function apiError(label: string, status: number, body: JsonRecord): string {
  const nested = body.error;
  const message =
    typeof nested === "string"
      ? nested
      : typeof nested?.message === "string"
        ? nested.message
        : JSON.stringify(body).slice(0, 300);
  return `${label} ${status}: ${message}`;
}

export function textFromResponses(body: JsonRecord): string {
  if (typeof body.output_text === "string") return body.output_text;
  const chunks: string[] = [];
  for (const item of body.output ?? []) {
    if (item.type && item.type !== "message") continue;
    collectText(item.content, chunks);
  }
  return chunks.join("\n");
}

function collectText(content: unknown, chunks: string[]) {
  if (typeof content === "string") {
    chunks.push(content);
    return;
  }
  if (!Array.isArray(content)) return;
  for (const part of content) {
    if (typeof part === "string") chunks.push(part);
    else if (part && typeof part === "object" && "text" in part && typeof part.text === "string") {
      chunks.push(part.text);
    }
  }
}

export function parseDraft(text: string, ticker: Ticker): SignalDraft {
  const parsed = extractJson(text);
  const score = boundedNumber(parsed.sentiment_score, -1, 1, "sentiment_score");
  const confidence = boundedNumber(parsed.confidence, 0, 1, "confidence");
  const action = String(parsed.recommended_action ?? "").toUpperCase();
  if (!isRecommendedAction(action)) {
    throw new Error("Model recommended_action must be BUY, SELL, or HOLD");
  }
  const summary = String(parsed.summary_catalyst ?? "").trim();
  if (!summary) throw new Error("Model summary_catalyst was empty");
  if (parsed.ticker != null && parsed.ticker !== "" && String(parsed.ticker).toUpperCase() !== ticker) {
    throw new Error(`Model ticker was not ${ticker}`);
  }
  return {
    ticker,
    sentiment_score: score,
    confidence,
    recommended_action: action,
    summary_catalyst: summary.slice(0, 500),
  };
}

function extractJson(text: string): Record<string, unknown> {
  const trimmed = text.trim();
  const candidate = trimmed.startsWith("{") ? trimmed : trimmed.match(/\{[\s\S]*\}/)?.[0];
  if (!candidate) throw new Error("Model did not return JSON");
  const parsed = JSON.parse(candidate) as unknown;
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("Model JSON was not an object");
  }
  return parsed as Record<string, unknown>;
}

function boundedNumber(value: unknown, min: number, max: number, label: string): number {
  const number = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(number)) throw new Error(`Model ${label} was not a number`);
  if (number < min - 0.001 || number > max + 0.001) {
    throw new Error(`Model ${label} ${number} is outside ${min}..${max}`);
  }
  return Math.min(max, Math.max(min, number));
}
