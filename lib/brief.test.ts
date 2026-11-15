import assert from "node:assert/strict";
import test from "node:test";
import { buildBrief } from "./brief";
import { DEFAULT_PORTFOLIO, type SentimentSignal, type Trade } from "../types/database";

const signal: SentimentSignal = {
  id: "s1",
  ticker: "BTC",
  sentiment_score: 0.8,
  confidence: 0.9,
  summary_catalyst: "Sample headline.",
  recommended_action: "BUY",
  created_at: "2026-11-14T00:00:00.000Z",
};

const trade: Trade = {
  id: "t1",
  ticker: "BTC",
  action: "BUY",
  amount_usd: 500,
  price_at_execution: 100,
  trigger_signal_id: "s1",
  created_at: "2026-11-14T00:00:01.000Z",
};

test("brief reports paper pnl and refuses to invent a total without prices", () => {
  const priced = buildBrief({
    dataMode: "memory",
    sentimentMode: "sample",
    portfolio: { ...DEFAULT_PORTFOLIO, cash_balance: 9500, holdings: { BTC: 5 } },
    prices: { BTC: 110, ETH: 1, SOL: 1 },
    signals: [signal],
    trades: [trade],
  });
  assert.equal(priced.paper, true);
  assert.equal(priced.totalValueUsd, 10050);
  assert.equal(priced.pnlUsd, 50);
  assert.equal(priced.signals[0]?.catalyst, "Sample headline.");
  assert.equal(priced.limits.length, 2);

  const blind = buildBrief({
    dataMode: "supabase",
    sentimentMode: "grok",
    portfolio: DEFAULT_PORTFOLIO,
    prices: null,
    signals: [],
    trades: [],
  });
  assert.equal(blind.totalValueUsd, null);
  assert.equal(blind.pnlUsd, null);
});
