import { portfolioValue } from "./format";
import type { Portfolio, Prices, SentimentSignal, Trade } from "../types/database";

export type DeskBrief = {
  paper: true;
  sharedBook: true;
  dataMode: "supabase" | "memory";
  sentimentMode: "grok" | "sample";
  cashUsd: number;
  totalValueUsd: number | null;
  pnlUsd: number | null;
  signals: Array<{
    ticker: SentimentSignal["ticker"];
    action: SentimentSignal["recommended_action"];
    score: number;
    confidence: number;
    catalyst: string;
    at: string;
  }>;
  trades: Array<{
    ticker: Trade["ticker"];
    action: Trade["action"];
    amountUsd: number;
    price: number;
    at: string;
  }>;
  limits: string[];
};

const STARTING_CASH = 10_000;

export function buildBrief(input: {
  dataMode: DeskBrief["dataMode"];
  sentimentMode: DeskBrief["sentimentMode"];
  portfolio: Portfolio;
  prices: Prices | null;
  signals: SentimentSignal[];
  trades: Trade[];
}): DeskBrief {
  const total = portfolioValue(input.portfolio, input.prices);
  return {
    paper: true,
    sharedBook: true,
    dataMode: input.dataMode,
    sentimentMode: input.sentimentMode,
    cashUsd: input.portfolio.cash_balance,
    totalValueUsd: total,
    pnlUsd: total == null ? null : Math.round((total - STARTING_CASH) * 100) / 100,
    signals: input.signals.slice(0, 6).map((signal) => ({
      ticker: signal.ticker,
      action: signal.recommended_action,
      score: signal.sentiment_score,
      confidence: signal.confidence,
      catalyst: signal.summary_catalyst,
      at: signal.created_at,
    })),
    trades: input.trades.slice(0, 6).map((trade) => ({
      ticker: trade.ticker,
      action: trade.action,
      amountUsd: trade.amount_usd,
      price: trade.price_at_execution,
      at: trade.created_at,
    })),
    limits: [
      "Paper trading. This does not place a real order.",
      "Do not call POST /api/grok-scan or POST /api/portfolio/reset from a briefing.",
    ],
  };
}
