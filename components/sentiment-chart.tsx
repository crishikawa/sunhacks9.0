"use client";

import { useMemo } from "react";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Panel, PanelHead } from "@/components/panel";
import { Tick } from "@/components/tick";
import { formatScore, formatWhen } from "@/lib/format";
import type { SentimentSignal, Ticker } from "@/types/database";
import { AXIS_TICK, DOWN, TOOLTIP_STYLE, UP, lineStyle } from "@/components/chart-style";

function markerDot(ticker: Ticker, stroke: string, onSelect: (ticker: Ticker) => void) {
  return function Dot(props: { cx?: number; cy?: number }) {
    const { cx, cy } = props;
    if (cx == null || cy == null || Number.isNaN(cx) || Number.isNaN(cy)) return <g />;
    return (
      <circle
        cx={cx}
        cy={cy}
        r={5}
        fill="var(--bg)"
        stroke={stroke}
        strokeWidth={2}
        style={{ cursor: "pointer" }}
        onClick={(event) => {
          event.stopPropagation();
          onSelect(ticker);
        }}
      />
    );
  };
}

export function SentimentChart({
  tickers,
  signals,
  buyThreshold,
  sellThreshold,
  onSelect,
}: {
  tickers: Ticker[];
  signals: SentimentSignal[];
  buyThreshold: number;
  sellThreshold: number;
  onSelect: (ticker: Ticker) => void;
}) {
  const key = tickers.join(",");
  const dots = useMemo(
    () => Object.fromEntries(key.split(",").map((ticker, index) => [ticker, markerDot(ticker, lineStyle(index).stroke, onSelect)])),
    [key, onSelect],
  );
  const data = signals
    .filter((signal) => tickers.includes(signal.ticker))
    .reverse()
    .map((signal) => ({ time: new Date(signal.created_at).getTime(), [signal.ticker]: signal.sentiment_score }));
  const plotted = tickers.filter((ticker) => signals.some((signal) => signal.ticker === ticker));

  return (
    <Panel>
      <PanelHead title="Grok sentiment, all coins" meta="click a point, or a coin tab above, to open that coin" />
      {data.length === 0 ? (
        <div className="flex h-64 flex-col items-center justify-center gap-3">
          <Tick mood="neutral" size={64} />
          <p className="text-sm text-muted">Run a Grok scan to plot the first point.</p>
        </div>
      ) : (
        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ top: 12, right: 12, left: -8, bottom: 0 }}>
              <CartesianGrid stroke="var(--line)" vertical={false} />
              <XAxis
                dataKey="time"
                type="number"
                domain={["dataMin", "dataMax"]}
                tickFormatter={(value) => formatWhen(new Date(Number(value)).toISOString()).split(",")[1]?.trim().split(" ")[0] ?? ""}
                stroke="var(--line)"
                tick={AXIS_TICK}
                tickLine={false}
              />
              <YAxis
                domain={[-1, 1]}
                ticks={[-1, -0.5, 0, 0.5, 1]}
                stroke="var(--line)"
                tick={AXIS_TICK}
                tickLine={false}
                tickFormatter={(value) => formatScore(Number(value))}
              />
              <Tooltip
                contentStyle={TOOLTIP_STYLE}
                labelStyle={{ color: "var(--muted)" }}
                cursor={{ stroke: "var(--dim)" }}
                labelFormatter={(value) => formatWhen(new Date(Number(value)).toISOString())}
                formatter={(value, name) => [typeof value === "number" ? formatScore(value) : "—", name]}
              />
              <Legend
                iconType="plainline"
                wrapperStyle={{ cursor: "pointer", fontSize: 12, color: "var(--muted)" }}
                onClick={(entry) => {
                  if (typeof entry.dataKey === "string") onSelect(entry.dataKey);
                }}
              />
              <ReferenceLine y={0} stroke="var(--line)" />
              <ReferenceLine
                y={buyThreshold}
                stroke={UP}
                strokeDasharray="4 4"
                label={{ value: `buy ${formatScore(buyThreshold)}`, position: "insideTopRight", fill: UP, fontSize: 11 }}
              />
              <ReferenceLine
                y={sellThreshold}
                stroke={DOWN}
                strokeDasharray="4 4"
                label={{ value: `sell ${formatScore(sellThreshold)}`, position: "insideBottomRight", fill: DOWN, fontSize: 11 }}
              />
              {plotted.map((ticker) => (
                <Line
                  key={ticker}
                  type="linear"
                  dataKey={ticker}
                  stroke={lineStyle(tickers.indexOf(ticker)).stroke}
                  strokeDasharray={lineStyle(tickers.indexOf(ticker)).dash}
                  strokeWidth={1.5}
                  connectNulls
                  dot={dots[ticker]}
                  activeDot={dots[ticker]}
                  isAnimationActive={false}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </Panel>
  );
}
