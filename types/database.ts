/** Uppercase coin symbol, e.g. "BTC". Any coin on the watchlist. */
export type Ticker = string;

/** A coin the desk tracks. coingecko_id drives prices, history and search. */
export type Asset = {
  symbol: Ticker;
  coingecko_id: string;
  name: string;
  thumb: string | null;
};

export const DEFAULT_WATCHLIST: Asset[] = [
  { symbol: "BTC", coingecko_id: "bitcoin", name: "Bitcoin", thumb: null },
  { symbol: "ETH", coingecko_id: "ethereum", name: "Ethereum", thumb: null },
  { symbol: "SOL", coingecko_id: "solana", name: "Solana", thumb: null },
];
export type RecommendedAction = "BUY" | "SELL" | "HOLD";
export type TradeAction = "BUY" | "SELL";

export type SentimentSignal = {
  id: string;
  ticker: Ticker;
  sentiment_score: number;
  confidence: number;
  summary_catalyst: string;
  recommended_action: RecommendedAction;
  created_at: string;
};

export type Trade = {
  id: string;
  ticker: Ticker;
  action: TradeAction;
  amount_usd: number;
  price_at_execution: number;
  trigger_signal_id: string;
  created_at: string;
};

export type Portfolio = {
  id: number;
  cash_balance: number;
  /** Coin quantity by symbol. Missing means zero. */
  holdings: Record<Ticker, number>;
};

export type Prices = Record<Ticker, number>;

export type Strategy = {
  buyThreshold: number;
  sellThreshold: number;
  minConfidence: number;
  tradeSizeUsd: number;
};

export type SignalDraft = Omit<SentimentSignal, "id" | "created_at">;

export type SentimentSource = "grok" | "sample";

export type ScanTickerResult = {
  ticker: Ticker;
  source: SentimentSource;
  signal: SentimentSignal | null;
  trade: Trade | null;
  skippedReason: string | null;
  error: string | null;
};

export type ScanResponse = {
  results: ScanTickerResult[];
  portfolio: Portfolio;
};

export type RealtimeConfig = {
  dataMode: "supabase" | "memory";
  sentimentMode: SentimentSource;
  supabase: { url: string; anonKey: string } | null;
  /** False until the watchlist/holdings migration has run on Supabase. */
  watchlist: boolean;
};

export const DEFAULT_PORTFOLIO: Portfolio = {
  id: 1,
  cash_balance: 10000,
  holdings: {},
};

export const DEFAULT_STRATEGY: Strategy = {
  buyThreshold: 0.7,
  sellThreshold: -0.7,
  minConfidence: 0.75,
  tradeSizeUsd: 500,
};

export function isTicker(value: unknown): value is Ticker {
  return typeof value === "string" && /^[A-Z0-9]{1,15}$/.test(value);
}
