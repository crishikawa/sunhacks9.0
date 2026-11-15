"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowRight } from "lucide-react";
import { Tick } from "@/components/tick";
import { formatClock, formatPrice, formatScore } from "@/lib/format";
import type { Asset, SentimentSignal } from "@/types/database";

type Live = { signals: SentimentSignal[]; prices: Record<string, number>; watchlist: Asset[] };

const STEPS = [
  {
    title: "Read",
    body: "Grok searches live posts on X and the day's headlines for every coin on your watchlist.",
  },
  {
    title: "Score",
    body: "Each read becomes a number from −1 to +1, a confidence level, and a one-line reason you can check.",
  },
  {
    title: "Trade",
    body: "Your rule decides. When a signal clears your thresholds, the desk paper-fills at the live CoinGecko price.",
  },
];

export function Landing() {
  const [live, setLive] = useState<Live | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const [signals, prices, watchlist] = await Promise.all([
        fetch("/api/signals", { cache: "no-store" }).then((r) => (r.ok ? r.json() : [])).catch(() => []),
        fetch("/api/prices", { cache: "no-store" }).then((r) => (r.ok ? r.json() : {})).catch(() => ({})),
        fetch("/api/watchlist", { cache: "no-store" }).then((r) => (r.ok ? r.json() : {})).catch(() => ({})),
      ]);
      if (cancelled) return;
      setLive({
        signals: Array.isArray(signals) ? (signals as SentimentSignal[]) : [],
        prices: prices && typeof prices === "object" && !("error" in prices) ? (prices as Record<string, number>) : {},
        watchlist: (watchlist as { watchlist?: Asset[] }).watchlist ?? [],
      });
    };
    void load();
    const timer = window.setInterval(() => void load(), 30_000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, []);

  const names = Object.fromEntries((live?.watchlist ?? []).map((asset) => [asset.symbol, asset.name]));
  const tape = (live?.watchlist ?? []).filter((asset) => live?.prices[asset.symbol] != null);
  const latest = live?.signals.slice(0, 4) ?? [];

  return (
    <div className="flex min-h-dvh flex-1 flex-col bg-bg text-fg">
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-5 lg:px-10">
        <Link href="/" className="flex items-center gap-2.5" aria-label="TickSense home">
          <Tick mood="neutral" size={30} />
          <span className="text-base font-semibold tracking-tight">TickSense</span>
        </Link>
        <nav className="flex items-center gap-6 text-sm">
          <a href="#how" className="hidden text-soft transition-colors hover:text-fg sm:inline">
            How it works
          </a>
          <Link
            href="/market"
            className="rounded-lg border border-line px-3.5 py-2 font-medium transition-colors hover:border-fg"
          >
            Open the desk
          </Link>
        </nav>
      </header>

      <main className="flex flex-1 flex-col">
        <section className="relative overflow-hidden">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 opacity-[0.55]"
            style={{
              backgroundImage: "radial-gradient(var(--line) 1px, transparent 1px)",
              backgroundSize: "22px 22px",
              maskImage: "radial-gradient(ellipse 70% 60% at 70% 40%, black 30%, transparent 75%)",
              WebkitMaskImage: "radial-gradient(ellipse 70% 60% at 70% 40%, black 30%, transparent 75%)",
            }}
          />
          <div className="relative mx-auto grid w-full max-w-6xl items-center gap-14 px-6 pt-12 pb-20 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)] lg:px-10 lg:pt-20 lg:pb-28">
            <div className="flex flex-col gap-7">
              <p className="text-sm font-medium text-up">Grok sentiment · paper trading</p>
              <h1 className="max-w-[13ch] text-5xl leading-[1.02] font-semibold tracking-[-0.035em] text-balance sm:text-6xl lg:text-7xl">
                Trade the mood before the price.
              </h1>
              <p className="max-w-[46ch] text-lg leading-8 text-soft">
                Crypto moves on what people are saying. TickSense reads X and the news with Grok, scores the sentiment
                on every coin you follow, and trades a paper book by your rules.
              </p>
              <div className="flex flex-wrap items-center gap-3">
                <Link
                  href="/market"
                  className="group inline-flex h-12 items-center gap-2 rounded-lg bg-fg px-6 text-[15px] font-semibold text-bg transition-opacity hover:opacity-90"
                >
                  Open the desk
                  <ArrowRight size={17} className="transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
                </Link>
                <a
                  href="#how"
                  className="inline-flex h-12 items-center rounded-lg px-4 text-[15px] font-medium text-soft transition-colors hover:text-fg"
                >
                  See how it works
                </a>
              </div>
              <p className="text-sm text-muted">Starts with $10,000 in paper cash. No account, no real money.</p>
            </div>

            <div className="rounded-2xl border border-line bg-bg shadow-[0_24px_60px_-28px_rgba(0,0,0,0.35)]">
              <div className="flex items-center justify-between border-b border-line px-5 py-4">
                <span className="flex items-center gap-2 text-sm font-semibold">
                  <span className="relative flex h-2 w-2">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-up opacity-60 motion-reduce:hidden" />
                    <span className="relative inline-flex h-2 w-2 rounded-full bg-up" />
                  </span>
                  Live from the desk
                </span>
                <span className="text-xs text-muted">latest Grok reads</span>
              </div>
              <ol>
                {live == null
                  ? [0, 1, 2, 3].map((index) => (
                      <li key={index} className="flex items-center gap-4 border-b border-line px-5 py-4 last:border-b-0">
                        <span className="h-4 w-24 animate-pulse rounded bg-panel" />
                        <span className="ml-auto h-4 w-16 animate-pulse rounded bg-panel" />
                      </li>
                    ))
                  : null}
                {live != null && latest.length === 0 ? (
                  <li className="px-5 py-10 text-center text-sm text-muted">No reads yet. Open the desk and run a scan.</li>
                ) : null}
                {latest.map((signal) => {
                  const up = signal.sentiment_score > 0.15;
                  const down = signal.sentiment_score < -0.15;
                  const width = Math.min(Math.abs(signal.sentiment_score), 1) * 50;
                  return (
                    <li key={signal.id} className="flex flex-col gap-2 border-b border-line px-5 py-4 last:border-b-0">
                      <div className="flex items-center gap-3">
                        <span className="w-12 text-sm font-semibold">{signal.ticker}</span>
                        <span className="relative h-1.5 flex-1 rounded-full bg-panel" aria-hidden="true">
                          <span className="absolute -top-1 left-1/2 h-3.5 w-px bg-dim" />
                          <span
                            className={`absolute top-0 h-1.5 rounded-full ${up ? "bg-up" : down ? "bg-down" : "bg-dim"}`}
                            style={{ width: `${width}%`, left: signal.sentiment_score >= 0 ? "50%" : `${50 - width}%` }}
                          />
                        </span>
                        <span
                          className={`w-12 text-right text-sm font-semibold tabular-nums ${up ? "text-up" : down ? "text-down" : "text-muted"}`}
                        >
                          {formatScore(signal.sentiment_score)}
                        </span>
                      </div>
                      <p className="line-clamp-1 text-sm text-soft">{signal.summary_catalyst}</p>
                      <span className="text-xs text-muted">
                        {names[signal.ticker] ?? signal.ticker} · {Math.round(signal.confidence * 100)}% confidence ·{" "}
                        {formatClock(signal.created_at)}
                      </span>
                    </li>
                  );
                })}
              </ol>
            </div>
          </div>
        </section>

        <section aria-label="Live prices" className="overflow-hidden border-y border-line bg-panel">
          <div className="landing-tape flex w-max gap-10 py-3.5 whitespace-nowrap">
            {(tape.length ? [...tape, ...tape, ...tape, ...tape] : []).map((asset, index) => (
              <span key={`${asset.symbol}-${index}`} className="text-sm" aria-hidden={index >= tape.length}>
                <span className="font-semibold">{asset.symbol}</span>{" "}
                <span className="text-soft tabular-nums">{formatPrice(live!.prices[asset.symbol])}</span>
              </span>
            ))}
            {tape.length === 0 ? <span className="px-6 text-sm text-muted">Loading live prices…</span> : null}
          </div>
        </section>

        <section id="how" className="mx-auto w-full max-w-6xl scroll-mt-8 px-6 py-24 lg:px-10">
          <div className="flex max-w-2xl flex-col gap-4">
            <h2 className="text-3xl font-semibold tracking-[-0.02em] sm:text-4xl">From a post on X to a filled order</h2>
            <p className="text-lg text-soft">Three steps, every time you run a scan. Nothing trades unless your rule agrees.</p>
          </div>
          <ol className="mt-14 grid gap-px overflow-hidden rounded-2xl border border-line bg-line md:grid-cols-3">
            {STEPS.map((step, index) => (
              <li key={step.title} className="flex flex-col gap-3 bg-bg p-7">
                <span className="text-sm font-medium text-muted tabular-nums">0{index + 1}</span>
                <h3 className="text-xl font-semibold">{step.title}</h3>
                <p className="leading-7 text-soft">{step.body}</p>
              </li>
            ))}
          </ol>
          <div className="mt-14 flex flex-wrap items-center justify-between gap-6 rounded-2xl bg-fg px-8 py-8 text-bg">
            <div className="flex flex-col gap-1">
              <span className="text-xl font-semibold">See it on live data.</span>
              <span className="text-sm opacity-70">Shared demo book. $10,000 paper cash. Any coin on CoinGecko.</span>
            </div>
            <Link
              href="/market"
              className="group inline-flex h-12 items-center gap-2 rounded-lg bg-bg px-6 text-[15px] font-semibold text-fg transition-opacity hover:opacity-90"
            >
              Open the desk
              <ArrowRight size={17} className="transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
            </Link>
          </div>
        </section>
      </main>

      <footer className="border-t border-line">
        <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-4 px-6 py-6 text-xs text-muted lg:px-10">
          <span className="flex items-center gap-2">
            <Tick mood="neutral" size={20} /> TickSense · SunHacks 9.0
          </span>
          <span>Paper trading only. Not investment advice. Sentiment is a model output.</span>
        </div>
      </footer>
    </div>
  );
}
