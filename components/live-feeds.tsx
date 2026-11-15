"use client";

import { CoinAvatar, Panel, PanelHead } from "@/components/panel";
import { Tick } from "@/components/tick";
import { formatClock, formatPrice, formatUsd } from "@/lib/format";
import type { Asset, SentimentSignal, Trade } from "@/types/database";

export function SignalFeed({ signals, assets }: { signals: SentimentSignal[]; assets: Record<string, Asset> }) {
  return (
    <Panel>
      <PanelHead title="Grok signals" meta={signals.length ? `${signals.length} saved` : undefined} />
      {signals.length === 0 ? (
        <Empty text="Run a scan and Grok's read on each coin lands here." />
      ) : (
        <ol className="-mx-5 -mb-5 max-h-[30rem] overflow-auto">
          {signals.map((signal) => (
            <li key={signal.id} className="flex gap-3 border-t border-line px-5 py-4">
              <CoinAvatar symbol={signal.ticker} thumb={assets[signal.ticker]?.thumb} size={32} />
              <div className="flex min-w-0 flex-1 flex-col gap-1">
                <div className="flex items-baseline justify-between gap-3">
                  <span className="text-sm font-medium">{assets[signal.ticker]?.name ?? signal.ticker}</span>
                  <Score value={signal.sentiment_score} />
                </div>
                <p className="text-sm leading-5 text-soft">{signal.summary_catalyst}</p>
                <div className="flex items-baseline justify-between gap-3 text-xs text-muted">
                  <span>
                    {formatClock(signal.created_at)} · {Math.round(signal.confidence * 100)}% confidence
                  </span>
                  <Action action={signal.recommended_action} />
                </div>
              </div>
            </li>
          ))}
        </ol>
      )}
    </Panel>
  );
}

export function TradeLog({ trades, assets }: { trades: Trade[]; assets: Record<string, Asset> }) {
  return (
    <Panel>
      <PanelHead title="Orders" meta={trades.length ? `${trades.length} filled · paper money` : "paper money"} />
      {trades.length === 0 ? (
        <Empty text="Orders show up here when a signal clears your rule." />
      ) : (
        <ol className="-mx-5 -mb-5 max-h-[26rem] overflow-auto">
          {trades.map((trade) => (
            <li key={trade.id} className="flex items-center gap-3 border-t border-line px-5 py-3.5">
              <CoinAvatar symbol={trade.ticker} thumb={assets[trade.ticker]?.thumb} size={32} />
              <div className="flex min-w-0 flex-1 flex-col">
                <span className="text-sm font-medium">
                  {trade.action === "BUY" ? "Bought" : "Sold"} {assets[trade.ticker]?.name ?? trade.ticker}
                </span>
                <span className="text-xs text-muted">{formatClock(trade.created_at)}</span>
              </div>
              <div className="flex flex-col items-end">
                <span className={`text-sm font-medium ${trade.action === "BUY" ? "text-up" : "text-down"}`}>
                  {trade.action === "BUY" ? "+" : "−"}
                  {formatUsd(trade.amount_usd)}
                </span>
                <span className="text-xs text-muted">@ {formatPrice(trade.price_at_execution)}</span>
              </div>
            </li>
          ))}
        </ol>
      )}
    </Panel>
  );
}

function Empty({ text }: { text: string }) {
  return (
    <div className="flex items-center gap-4 py-4">
      <Tick mood="neutral" size={48} />
      <p className="max-w-xs text-sm text-muted">{text}</p>
    </div>
  );
}

function Score({ value }: { value: number }) {
  const tone = value > 0.15 ? "text-up" : value < -0.15 ? "text-down" : "text-muted";
  return (
    <span className={`shrink-0 text-sm font-medium ${tone}`}>
      {value > 0 ? "+" : value < 0 ? "−" : ""}
      {Math.abs(value).toFixed(2)}
    </span>
  );
}

function Action({ action }: { action: string }) {
  const tone =
    action === "BUY" ? "bg-up/10 text-up" : action === "SELL" ? "bg-down/10 text-down" : "bg-panel text-muted";
  return <span className={`rounded px-2 py-0.5 text-[11px] font-semibold ${tone}`}>{action}</span>;
}
