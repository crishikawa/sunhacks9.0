"use client";

import { useEffect, useState } from "react";
import { Line, LineChart, ReferenceDot, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { CoinAvatar } from "@/components/panel";
import { Tick, moodFromScore } from "@/components/tick";
import { DOWN, TOOLTIP_STYLE, UP } from "@/components/chart-style";
import { formatChartTime, formatClock, formatPrice, formatScore, formatUsd } from "@/lib/format";
import { CHART_RANGE_LABEL, CHART_RANGES, type ChartRange, type PricePoint } from "@/lib/prices";
import type { Asset, SentimentSignal, Ticker } from "@/types/database";

const RANGE_TITLE: Record<ChartRange, string> = {
  "1h": "Last hour",
  "1d": "Last 24 hours",
};

export function CoinHero({
  asset,
  livePrice,
  signals,
  scanning,
  onRemove,
}: {
  asset: Asset;
  onRemove: (() => void) | null;
  livePrice: number | undefined;
  signals: SentimentSignal[];
  scanning: boolean;
}) {
  const ticker: Ticker = asset.symbol;
  const latest = signals.find((signal) => signal.ticker === ticker);
  const mood = scanning ? "scan" : moodFromScore(latest?.sentiment_score);
  const feeling = { bull: "Feeling bullish", bear: "Feeling worried", neutral: "Feeling calm", scan: "Reading the room…" }[mood];
  const [range, setRange] = useState<ChartRange>("1d");
  const [history, setHistory] = useState<{ ticker: Ticker; range: ChartRange; points: PricePoint[] } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = () =>
      fetch(`/api/prices/history?ticker=${ticker}&range=${range}`, { cache: "no-store" })
      .then(async (response) => {
        const body = (await response.json()) as { points?: PricePoint[]; error?: string };
        if (!response.ok) throw new Error(body.error ?? "Price history failed");
        return body.points ?? [];
      })
      .then((points) => {
        if (!cancelled) {
          setHistory({ ticker, range, points });
          setError(null);
        }
      })
      .catch((cause: unknown) => {
        if (!cancelled) setError(cause instanceof Error ? cause.message : "Price history failed");
      });
    void load();
    const timer = window.setInterval(() => void load(), 60_000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [ticker, range]);

  const selected = history?.ticker === ticker && history.range === range ? history.points : null;
  const shown = selected ?? (history?.ticker === ticker ? history.points : null);
  const open = selected?.[0]?.price;
  const price = livePrice ?? selected?.at(-1)?.price ?? shown?.at(-1)?.price;
  const change = selected && price != null && open != null ? price - open : null;
  const pct = change != null && open ? (change / open) * 100 : null;
  const up = change != null ? change >= 0 : shown != null && shown.length > 0 ? shown[shown.length - 1].price >= shown[0].price : true;
  const rangeLabel = CHART_RANGE_LABEL[range];

  // Pin each of this coin's Grok signals onto the nearest price point in the window.
  const markers =
    shown && shown.length
      ? signals
          .filter((signal) => signal.ticker === ticker)
          .flatMap((signal) => {
            const t = new Date(signal.created_at).getTime();
            if (t < shown[0].time || t > shown[shown.length - 1].time) return [];
            const nearest = shown.reduce((best, point) => (Math.abs(point.time - t) < Math.abs(best.time - t) ? point : best));
            return [{ id: signal.id, time: nearest.time, price: nearest.price, score: signal.sentiment_score }];
          })
          .slice(0, 40)
      : [];

  return (
    <section className="flex min-w-0 flex-col gap-4">
      <div className="flex items-center gap-3">
        <CoinAvatar symbol={ticker} thumb={asset.thumb} size={44} />
        <div className="flex flex-col">
          <h1 className="text-lg font-semibold leading-tight">{asset.name}</h1>
          <span className="text-xs text-muted">{ticker} · USD</span>
        </div>
        {onRemove ? (
          <button
            type="button"
            onClick={onRemove}
            className="ml-auto h-8 rounded-md border border-line px-3 text-xs font-medium text-muted transition-colors hover:border-down hover:text-down"
          >
            Remove from watchlist
          </button>
        ) : null}
      </div>
      <div className="flex flex-wrap items-end justify-between gap-4">
      <div className="flex flex-col gap-1">
        <span className="text-[34px] font-semibold leading-none tracking-tight">{price != null ? formatPrice(price) : "—"}</span>
        <span className={`text-sm font-medium ${change == null ? "text-muted" : up ? "text-up" : "text-down"}`}>
          {change == null
            ? `Loading ${rangeLabel} change…`
            : `${up ? "+" : "−"}${formatUsd(Math.abs(change))} (${Math.abs(pct ?? 0).toFixed(2)}%)`}
          <span className="ml-1.5 font-normal text-muted">{rangeLabel}</span>
        </span>
      </div>
      <div className="flex items-center gap-3" aria-live="polite">
        <div className="flex max-w-[15rem] flex-col items-end text-right">
          <span className="text-sm font-semibold">{feeling}</span>
          <span className="text-xs text-muted">
            {scanning
              ? `Grok is reading X and the news on ${ticker}`
              : latest
                ? `${ticker} ${formatScore(latest.sentiment_score)} · ${Math.round(latest.confidence * 100)}% sure · ${formatClock(latest.created_at)}`
                : `No Grok read on ${ticker} yet`}
          </span>
        </div>
        <Tick key={scanning ? "scan" : (latest?.id ?? "none")} mood={mood} size={64} className="tick-pop" />
      </div>
      </div>

      <div className="h-72 w-full">
        {error && !selected ? (
          <div className="flex h-full flex-col items-center justify-center gap-3 rounded-lg bg-panel text-center">
            <Tick mood="neutral" size={48} />
            <p className="max-w-xs text-sm text-muted">
              {error.includes("429")
                ? "The free price feed is busy. Tick will retry in a minute."
                : `Couldn't load the price chart. ${error}`}
            </p>
          </div>
        ) : !shown ? (
          <div className="h-full animate-pulse rounded-lg bg-panel" />
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={shown} margin={{ top: 8, right: 4, left: 4, bottom: 8 }}>
              <XAxis dataKey="time" type="number" domain={["dataMin", "dataMax"]} hide />
              <YAxis domain={["auto", "auto"]} hide />
              {open != null ? <ReferenceLine y={open} stroke="var(--dim)" strokeDasharray="3 4" /> : null}
              <Tooltip
                contentStyle={TOOLTIP_STYLE}
                cursor={{ stroke: "var(--dim)" }}
                labelFormatter={(value) => formatChartTime(new Date(Number(value)).toISOString(), range)}
                formatter={(value) => [typeof value === "number" ? formatPrice(value) : "—", "Price"]}
              />
              <Line
                type="linear"
                dataKey="price"
                stroke={up ? UP : DOWN}
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4, fill: up ? UP : DOWN, stroke: "var(--bg)", strokeWidth: 2 }}
                isAnimationActive={false}
              />
              {markers.map((marker) => (
                <ReferenceDot
                  key={marker.id}
                  x={marker.time}
                  y={marker.price}
                  r={5}
                  fill="var(--bg)"
                  stroke={marker.score >= 0 ? UP : DOWN}
                  strokeWidth={2}
                  ifOverflow="extendDomain"
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line pb-4 text-xs text-muted">
        <div className="flex flex-wrap items-center gap-1" role="group" aria-label="Chart range">
          {CHART_RANGES.map((option) => (
            <button
              key={option}
              type="button"
              title={RANGE_TITLE[option]}
              aria-pressed={option === range}
              onClick={() => {
                if (option === range) return;
                setError(null);
                setRange(option);
              }}
              className={`rounded-full border px-3 py-1 font-medium transition-colors ${
                option === range ? "border-fg text-fg" : "border-transparent text-muted hover:text-fg"
              }`}
            >
              {CHART_RANGE_LABEL[option]}
            </button>
          ))}
        </div>
        <span className="flex items-center gap-4">
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full border-2 border-up bg-bg" /> bullish signal
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full border-2 border-down bg-bg" /> bearish signal
          </span>
          {markers[0] ? (
            <span className="hidden sm:inline">
              latest {formatScore(markers[0].score)} at {formatClock(new Date(markers[0].time).toISOString())}
            </span>
          ) : null}
        </span>
      </div>
    </section>
  );
}
