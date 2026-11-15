import assert from "node:assert/strict";
import test from "node:test";
import { deskBrief, mentionedCoins, moodFor, parseChat, sampleReply, type DeskContext } from "./chat";

const desk: DeskContext = {
  cash: 2500,
  trades: [],
  coins: [
    {
      symbol: "BTC",
      name: "Bitcoin",
      price: 64000,
      change24h: -3.5,
      held: 0.02,
      signal: {
        id: "s1",
        ticker: "BTC",
        sentiment_score: -0.84,
        confidence: 0.9,
        summary_catalyst: "Risk-off turn after ETF outflows.",
        recommended_action: "SELL",
        created_at: "2026-11-15T08:00:00.000Z",
      },
    },
    { symbol: "SOL", name: "Solana", price: 70, change24h: 4.2, held: 0, signal: null },
  ],
};

test("chat input is validated and trimmed to recent history", () => {
  assert.throws(() => parseChat({}), /array/);
  assert.throws(() => parseChat({ messages: [{ role: "system", content: "hi" }] }), /role/);
  assert.throws(() => parseChat({ messages: [{ role: "user", content: "x".repeat(1501) }] }), /1500/);
  assert.throws(() => parseChat({ messages: [{ role: "assistant", content: "hi" }] }), /last message/);
  const many = Array.from({ length: 20 }, (_, i) => ({ role: i % 2 ? "assistant" : "user", content: `m${i}` }));
  many.push({ role: "user", content: "last" });
  assert.equal(parseChat({ messages: many }).length, 12);
});

test("coins are found by ticker, $ticker or name, not inside other words", () => {
  assert.deepEqual(mentionedCoins("how is $btc doing", desk.coins).map((c) => c.symbol), ["BTC"]);
  assert.deepEqual(mentionedCoins("thoughts on solana?", desk.coins).map((c) => c.symbol), ["SOL"]);
  assert.deepEqual(mentionedCoins("that was a solid console", desk.coins), []);
});

test("Tick's mood follows the coin's latest read", () => {
  assert.equal(moodFor("how is bitcoin", desk), "bear");
  assert.equal(moodFor("how is SOL", desk), "neutral");
});

test("offline answers use desk numbers and stay on crypto", () => {
  const btc = sampleReply("How is BTC doing?", desk);
  assert.match(btc, /Bitcoin is at \$64,000\.00, −3\.50% in 24 hours/);
  assert.match(btc, /−0\.84 with 90% confidence/);
  assert.match(btc, /You hold 0\.02 BTC/);
  assert.match(sampleReply("what about tesla stock", desk), /tracks crypto, not stocks/);
  assert.match(sampleReply("how is my portfolio", desk), /\$2,500\.00 in cash/);
  assert.match(deskBrief(desk), /SOL \(Solana\); price \$70\.00; 24h \+4\.20%; no read yet/);
});
