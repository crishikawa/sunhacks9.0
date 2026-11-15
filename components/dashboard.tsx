"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { Moon, Sun } from "lucide-react";
import { createClient, type RealtimeChannel, type SupabaseClient } from "@supabase/supabase-js";
import { SignalFeed, TradeLog } from "@/components/live-feeds";
import { Panel } from "@/components/panel";
import { SentimentChart } from "@/components/sentiment-chart";
import { CoinHero } from "@/components/ticker-chart";
import { CoinSearch } from "@/components/coin-search";
import { AskTick } from "@/components/ask-tick";
import { Tick, type Mood } from "@/components/tick";
import { formatCoin, formatPrice, formatScore, formatUsd, portfolioValue } from "@/lib/format";
import {
  DEFAULT_STRATEGY,
  DEFAULT_WATCHLIST,
  isTicker,
  type Asset,
  type Portfolio,
  type Prices,
  type RealtimeConfig,
  type ScanResponse,
  type SentimentSignal,
  type Strategy,
  type Trade,
  type Ticker,
} from "@/types/database";


export function Dashboard({ deskSecret = "" }: { deskSecret?: string }) {
  const [watchlist, setWatchlist] = useState<Asset[]>(DEFAULT_WATCHLIST);
  const [prices, setPrices] = useState<Prices | null>(null);
  const [priceError, setPriceError] = useState<string | null>(null);
  const [portfolio, setPortfolio] = useState<Portfolio | null>(null);
  const [signals, setSignals] = useState<SentimentSignal[]>([]);
  const [trades, setTrades] = useState<Trade[]>([]);
  const [strategy, setStrategy] = useState<Strategy>(DEFAULT_STRATEGY);
  const [config, setConfig] = useState<RealtimeConfig | null>(null);
  const [scanning, setScanning] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedTicker, setSelectedTicker] = useState<Ticker | null>(null);
  const generation = useRef(0);
  const [toast, setToast] = useState<Trade | null>(null);
  const toastTimer = useRef<number | undefined>(undefined);

  // Tick pops up whenever an order fills, from a scan on this page or over Realtime.
  const announce = useCallback((trade: Trade | undefined) => {
    if (!trade) return;
    setToast((current) => (current?.id === trade.id ? current : trade));
    window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(null), 5000);
  }, []);

  const refreshDesk = useCallback(async () => {
    const token = ++generation.current;
    const [portfolioRes, signalRes, tradeRes, watchRes] = await Promise.all([
      fetch("/api/portfolio", { cache: "no-store" }),
      fetch("/api/signals", { cache: "no-store" }),
      fetch("/api/trades", { cache: "no-store" }),
      fetch("/api/watchlist", { cache: "no-store" }),
    ]);
    if (token !== generation.current) return;
    if (!portfolioRes.ok) {
      const body = (await portfolioRes.json()) as { error?: string };
      setError(body.error ?? "Could not load the portfolio");
      return;
    }
    setPortfolio((await portfolioRes.json()) as Portfolio);
    setError((current) => (current?.includes("a table is missing") ? null : current));
    if (signalRes.ok) setSignals((await signalRes.json()) as SentimentSignal[]);
    if (tradeRes.ok) setTrades((await tradeRes.json()) as Trade[]);
    if (watchRes.ok) {
      const body = (await watchRes.json()) as { watchlist?: Asset[] };
      if (body.watchlist?.length) setWatchlist(body.watchlist);
    }
  }, []);

  const loadPrices = useCallback(async () => {
    try {
      const response = await fetch("/api/prices", { cache: "no-store" });
      const body = (await response.json()) as Record<string, unknown>;
      if (!response.ok) {
        setPriceError(typeof body.error === "string" ? body.error : "Price request failed");
        return;
      }
      const next: Prices = {};
      for (const [symbol, value] of Object.entries(body)) if (typeof value === "number") next[symbol] = value;
      setPrices(next);
      setPriceError(null);
    } catch {
      setPriceError("Price request failed");
    }
  }, []);

  useEffect(() => {
    const first = window.setTimeout(() => void loadPrices(), 0);
    const timer = window.setInterval(() => void loadPrices(), 20_000);
    return () => {
      window.clearTimeout(first);
      window.clearInterval(timer);
    };
  }, [loadPrices]);

  useEffect(() => {
    // With realtime the poll only reconciles missed rows; without it, keep a tight loop.
    const ms = config?.supabase ? 30_000 : 4_000;
    const timer = window.setInterval(() => void refreshDesk(), ms);
    return () => window.clearInterval(timer);
  }, [refreshDesk, config?.supabase]);

  useEffect(() => {
    let active = true;
    let client: SupabaseClient | null = null;
    let channel: RealtimeChannel | null = null;

    const boot = async () => {
      await refreshDesk();
      const response = await fetch("/api/config", { cache: "no-store" });
      if (!response.ok || !active) return;
      const nextConfig = (await response.json()) as RealtimeConfig;
      if (!active) return;
      setConfig(nextConfig);
      if (!nextConfig.supabase) return;
      client = createClient(nextConfig.supabase.url, nextConfig.supabase.anonKey);
      channel = client
        .channel("desk-live")
        .on("postgres_changes", { event: "INSERT", schema: "public", table: "sentiment_signals" }, (payload) => {
          const signal = readSignal(payload.new);
          if (!signal) return;
          setSignals((current) => prepend(current, signal));
        })
        .on("postgres_changes", { event: "INSERT", schema: "public", table: "trades" }, (payload) => {
          const trade = readTrade(payload.new);
          if (!trade) return;
          setTrades((current) => prepend(current, trade));
          announce(trade);
          void refreshDesk();
        })
        .subscribe();
      if (!active) {
        void client.removeChannel(channel);
      }
    };

    void boot();
    return () => {
      active = false;
      if (client && channel) void client.removeChannel(channel);
    };
  }, [refreshDesk, announce]);

  async function scan() {
    setScanning(true);
    setError(null);
    setStatus(null);
    try {
      const response = await fetch("/api/grok-scan", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          ...(deskSecret ? { "x-desk-secret": deskSecret } : {}),
        },
        body: JSON.stringify(strategy),
      });
      const body = (await response.json()) as ScanResponse & { error?: string };
      generation.current += 1;
      if (body.portfolio) setPortfolio(body.portfolio);
      if (body.results) {
        setSignals((current) => mergeFront(current, body.results.flatMap((item) => (item.signal ? [item.signal] : []))));
        const filled = body.results.flatMap((item) => (item.trade ? [item.trade] : []));
        setTrades((current) => mergeFront(current, filled));
        announce(filled[0]);
        setStatus(summarize(body));
      }
      if (!response.ok) setError(body.error ?? "Scan failed");
      await refreshDesk();
    } catch {
      setError("Scan failed");
    } finally {
      setScanning(false);
    }
  }

  async function addCoin(asset: Asset) {
    setError(null);
    const response = await fetch("/api/watchlist", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(asset),
    });
    const body = (await response.json()) as { watchlist?: Asset[]; error?: string };
    if (!response.ok || !body.watchlist) {
      setError(body.error ?? "Could not add the coin");
      return;
    }
    setWatchlist(body.watchlist);
    const added = body.watchlist.find((item) => item.coingecko_id === asset.coingecko_id);
    if (added) setSelectedTicker(added.symbol);
    setStatus(`Added ${asset.name}. Run a Grok scan to get Tick's read on it.`);
    void loadPrices();
  }

  async function removeCoin(symbol: string) {
    setError(null);
    const response = await fetch(`/api/watchlist?symbol=${encodeURIComponent(symbol)}`, { method: "DELETE" });
    const body = (await response.json()) as { watchlist?: Asset[]; error?: string };
    if (!response.ok || !body.watchlist) {
      setError(body.error ?? "Could not remove the coin");
      return;
    }
    setWatchlist(body.watchlist);
    setSelectedTicker(null);
    setStatus(`Removed ${symbol} from your watchlist.`);
  }

  async function reset() {
    if (!window.confirm("Reset cash to $10,000 and clear the trade log?")) return;
    setResetting(true);
    setError(null);
    try {
      const response = await fetch("/api/portfolio/reset", {
        method: "POST",
        headers: deskSecret ? { "x-desk-secret": deskSecret } : undefined,
      });
      const body = (await response.json()) as { portfolio?: Portfolio; error?: string };
      if (!response.ok || !body.portfolio) {
        setError(body.error ?? "Reset failed");
        return;
      }
      generation.current += 1;
      setPortfolio(body.portfolio);
      setTrades([]);
      setStatus("Demo portfolio reset to $10,000 cash. Signals were kept.");
      await refreshDesk();
    } catch {
      setError("Reset failed");
    } finally {
      setResetting(false);
    }
  }

  const total = portfolio ? portfolioValue(portfolio, prices) : null;
  const pnl = total == null ? null : Math.round((total - 10_000) * 100) / 100;
  const latest = signals[0];
  const mood: Mood = scanning
    ? "scan"
    : !latest
      ? "neutral"
      : latest.sentiment_score > 0.15
        ? "bull"
        : latest.sentiment_score < -0.15
          ? "bear"
          : "neutral";
  const latestTrade = latest ? trades.find((trade) => trade.trigger_signal_id === latest.id) : undefined;
  const tickLine = scanning
    ? "Reading X and the news…"
    : latest
      ? `${latest.ticker} ${formatScore(latest.sentiment_score)} · ${
          latestTrade ? `${latestTrade.action === "BUY" ? "bought" : "sold"} ${formatUsd(latestTrade.amount_usd)}` : "no trade"
        }`
      : "Waiting for the first scan";
  const tickers = watchlist.map((asset) => asset.symbol);
  const assets = Object.fromEntries(watchlist.map((asset) => [asset.symbol, asset]));
  const coin = selectedTicker && tickers.includes(selectedTicker) ? selectedTicker : (tickers[0] ?? null);
  const coinAsset = coin ? assets[coin] : undefined;

  return (
    <div className="min-h-full bg-bg text-fg">
      <header className="sticky top-0 z-20 border-b border-line bg-bg/95 backdrop-blur">
        <div className="mx-auto flex h-16 w-full max-w-[1200px] items-center gap-4 px-4 sm:gap-6 sm:px-6">
          <Link href="/" className="flex shrink-0 items-center gap-2.5" aria-label="TickSense home">
            <Tick mood={mood} size={34} />
            <span className="hidden text-lg font-semibold tracking-tight sm:inline">TickSense</span>
          </Link>
          <CoinSearch
            watchlist={watchlist}
            canAdd={config?.watchlist !== false}
            onAdd={addCoin}
            onOpen={setSelectedTicker}
          />
          <div className="ml-auto flex shrink-0 items-center gap-4">
            <span className="hidden text-xs text-muted xl:block" aria-live="polite">
              <span className="font-medium text-soft">Tick:</span> {tickLine}
            </span>
            <ThemeToggle />
          </div>
        </div>
        <nav
          aria-label="Your watchlist"
          className="mx-auto flex w-full max-w-[1200px] items-stretch gap-1 overflow-x-auto px-4 sm:px-6"
        >
          {watchlist.map((asset) => {
            const on = coin === asset.symbol;
            const price = prices?.[asset.symbol];
            return (
              <button
                key={asset.symbol}
                type="button"
                aria-pressed={on}
                onClick={() => setSelectedTicker(asset.symbol)}
                className={`flex h-11 shrink-0 items-center gap-2 border-b-2 px-3 text-sm transition-colors ${
                  on ? "border-up font-semibold text-fg" : "border-transparent text-muted hover:text-fg"
                }`}
              >
                {asset.symbol}
                <span className="font-normal text-muted">{price != null ? formatPrice(price) : priceError ? "—" : ""}</span>
              </button>
            );
          })}
        </nav>
      </header>

      <main className="mx-auto grid w-full max-w-[1200px] gap-8 px-4 py-8 sm:px-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="flex min-w-0 flex-col gap-8">
          {coinAsset ? (
            <CoinHero
              key={coinAsset.symbol}
              asset={coinAsset}
              livePrice={prices?.[coinAsset.symbol]}
              signals={signals}
              scanning={scanning}
              onRemove={config?.watchlist !== false && watchlist.length > 1 ? () => void removeCoin(coinAsset.symbol) : null}
            />
          ) : null}
          <SentimentChart
            tickers={tickers}
            signals={signals}
            buyThreshold={strategy.buyThreshold}
            sellThreshold={strategy.sellThreshold}
            onSelect={setSelectedTicker}
          />
          <TradeLog trades={trades} assets={assets} />
        </div>

        <aside className="flex min-w-0 flex-col gap-6">
          <Panel>
            <div className="flex flex-col gap-1">
              <span className="text-xs text-muted">Paper portfolio value</span>
              <span className="text-2xl font-semibold tracking-tight">{total == null ? "—" : formatUsd(total)}</span>
              {pnl != null ? (
                <span className={`text-sm font-medium ${pnl >= 0 ? "text-up" : "text-down"}`}>
                  {pnl >= 0 ? "+" : "−"}
                  {formatUsd(Math.abs(pnl))} <span className="font-normal text-muted">since the $10,000 start</span>
                </span>
              ) : null}
            </div>
            {portfolio ? (
              <dl className="-mx-5 -mb-5 border-t border-line">
                <Holding label="Cash" value={formatUsd(portfolio.cash_balance)} />
                {watchlist.map((asset) => {
                  const quantity = portfolio.holdings[asset.symbol] ?? 0;
                  const price = prices?.[asset.symbol];
                  return (
                    <Holding
                      key={asset.symbol}
                      label={asset.symbol}
                      value={price != null ? formatUsd(quantity * price) : "—"}
                      detail={`${formatCoin(quantity)} ${asset.symbol}`}
                    />
                  );
                })}
              </dl>
            ) : (
              <p className="text-sm text-muted">Loading the book…</p>
            )}
          </Panel>

          <Panel>
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-base font-semibold">Auto-trade</h2>
              <span className="text-xs text-muted">applies to every scan</span>
            </div>
            <div className="-mx-5 flex flex-col border-y border-line">
              <Field
                label="Buy when score is above"
                value={strategy.buyThreshold}
                step={0.05}
                onChange={(buyThreshold) => setStrategy((current) => ({ ...current, buyThreshold }))}
              />
              <Field
                label="Sell when score is below"
                value={strategy.sellThreshold}
                step={0.05}
                onChange={(sellThreshold) => setStrategy((current) => ({ ...current, sellThreshold }))}
              />
              <Field
                label="Minimum confidence"
                value={strategy.minConfidence}
                step={0.05}
                onChange={(minConfidence) => setStrategy((current) => ({ ...current, minConfidence }))}
              />
              <Field
                label="Order size ($)"
                value={strategy.tradeSizeUsd}
                step={50}
                onChange={(tradeSizeUsd) => setStrategy((current) => ({ ...current, tradeSizeUsd }))}
              />
            </div>
            {status ? <p className="text-xs leading-5 text-soft">{status}</p> : null}
            {error ? (
              <p role="alert" className="text-xs leading-5 text-down">
                {error}
              </p>
            ) : null}
            {priceError ? (
              <p role="alert" className="text-xs leading-5 text-down">
                {priceError}
              </p>
            ) : null}
            <button
              type="button"
              onClick={() => void scan()}
              disabled={scanning || resetting}
              className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-lg bg-up text-[15px] font-semibold text-bg transition-[filter] hover:brightness-95 disabled:opacity-60"
            >
              {scanning ? <Spinner /> : null}
              {scanning ? "Scanning…" : "Run Grok scan"}
            </button>
            <button
              type="button"
              onClick={() => void reset()}
              disabled={scanning || resetting}
              className="-mt-1 text-sm font-medium text-muted hover:text-fg disabled:opacity-50"
            >
              {resetting ? "Resetting…" : "Reset demo portfolio"}
            </button>
          </Panel>

          <SignalFeed signals={signals} assets={assets} />
        </aside>
      </main>

      {toast ? (
        <div
          key={toast.id}
          role="status"
          className="tick-pop fixed bottom-4 left-4 z-20 flex items-center gap-3 rounded-xl border border-line bg-bg py-3 pr-5 pl-3 shadow-lg sm:bottom-6 sm:left-6"
          style={{ marginBottom: "env(safe-area-inset-bottom)" }}
        >
          <Tick mood={toast.action === "BUY" ? "bull" : "bear"} size={48} />
          <div className="flex flex-col">
            <span className="text-sm font-semibold">
              {toast.action === "BUY" ? "Bought" : "Sold"} {formatUsd(toast.amount_usd)} of {toast.ticker}
            </span>
            <span className="text-xs text-muted">at {formatPrice(toast.price_at_execution)} · paper trade</span>
          </div>
        </div>
      ) : null}

      <AskTick deskSecret={deskSecret} coin={coin} />

      <footer className="mx-auto flex w-full max-w-[1200px] flex-wrap gap-x-6 gap-y-1 border-t border-line px-4 py-5 text-xs text-muted sm:px-6">
        <span>Sentiment: {config?.sentimentMode === "grok" ? "Grok, live" : "sample data (no xAI key)"}</span>
        <span>Book: {config?.dataMode === "supabase" ? "Supabase" : "server memory"}</span>
        <span>Realtime: {config?.supabase ? "on" : "off"}</span>
        <span className="ml-auto">
          Paper trading only. Not investment advice. Fills use the latest CoinGecko price; sentiment is a model output.
        </span>
      </footer>
    </div>
  );
}

function Field({
  label,
  value,
  step,
  onChange,
}: {
  label: string;
  value: number;
  step: number;
  onChange: (value: number) => void;
}) {
  return (
    <label className="flex items-center justify-between gap-4 border-b border-line px-5 py-3 text-sm text-soft last:border-b-0">
      {label}
      <input
        type="number"
        step={step}
        value={Number.isFinite(value) ? value : 0}
        onChange={(event) => onChange(event.target.value === "" ? 0 : Number(event.target.value))}
        className="h-9 w-24 rounded-md border border-line bg-bg px-2.5 text-right text-sm font-medium text-fg outline-none transition-colors hover:border-dim focus:border-up"
      />
    </label>
  );
}

function Holding({ label, value, detail }: { label: string; value: string; detail?: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-line px-5 py-3 last:border-b-0">
      <dt className="text-sm text-soft">{label}</dt>
      <dd className="flex flex-col items-end">
        <span className="text-sm font-medium">{value}</span>
        {detail ? <span className="text-xs text-muted">{detail}</span> : null}
      </dd>
    </div>
  );
}

function ThemeToggle() {
  function toggle() {
    const root = document.documentElement;
    const current =
      root.dataset.theme ?? (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
    const next = current === "dark" ? "light" : "dark";
    root.dataset.theme = next;
    try {
      localStorage.setItem("theme", next);
    } catch {}
  }
  return (
    <button
      type="button"
      onClick={toggle}
      aria-label="Switch between light and dark mode"
      title="Switch theme"
      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-line text-soft transition-colors hover:text-fg"
    >
      <Moon size={16} className="show-in-light" aria-hidden="true" />
      <Sun size={16} className="show-in-dark" aria-hidden="true" />
    </button>
  );
}

function Spinner() {
  return <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />;
}

function prepend<T extends { id: string }>(items: T[], next: T): T[] {
  if (items.some((item) => item.id === next.id)) return items;
  return [next, ...items].slice(0, 100);
}

function mergeFront<T extends { id: string }>(current: T[], incoming: T[]): T[] {
  const seen = new Set(current.map((item) => item.id));
  const fresh = incoming.filter((item) => !seen.has(item.id));
  return [...fresh, ...current].slice(0, 100);
}

function summarize(body: ScanResponse): string {
  return body.results
    .map((result) => {
      if (result.error) return `${result.ticker} failed`;
      if (result.trade) return `${result.ticker} ${result.trade.action} filled`;
      const why = result.skippedReason ? ` — ${result.skippedReason}` : "";
      return `${result.ticker} saved, no trade${why}`;
    })
    .join(" · ");
}

function readSignal(row: unknown): SentimentSignal | null {
  if (!row || typeof row !== "object") return null;
  const value = row as Partial<SentimentSignal>;
  if (!isTicker(value.ticker)) return null;
  if (value.recommended_action !== "BUY" && value.recommended_action !== "SELL" && value.recommended_action !== "HOLD") {
    return null;
  }
  if (!value.id || value.sentiment_score == null || value.confidence == null || !value.created_at) return null;
  return {
    id: String(value.id),
    ticker: value.ticker,
    sentiment_score: Number(value.sentiment_score),
    confidence: Number(value.confidence),
    summary_catalyst: String(value.summary_catalyst ?? ""),
    recommended_action: value.recommended_action,
    created_at: String(value.created_at),
  };
}

function readTrade(row: unknown): Trade | null {
  if (!row || typeof row !== "object") return null;
  const value = row as Partial<Trade>;
  if (!isTicker(value.ticker)) return null;
  if (value.action !== "BUY" && value.action !== "SELL") return null;
  if (!value.id || value.amount_usd == null || value.price_at_execution == null || !value.created_at) return null;
  return {
    id: String(value.id),
    ticker: value.ticker,
    action: value.action,
    amount_usd: Number(value.amount_usd),
    price_at_execution: Number(value.price_at_execution),
    trigger_signal_id: String(value.trigger_signal_id ?? ""),
    created_at: String(value.created_at),
  };
}
