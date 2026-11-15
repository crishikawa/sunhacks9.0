import type { Asset, Prices, Ticker } from "@/types/database";

export type PricePoint = { time: number; price: number };

const TTL_MS = 15_000;
const HEADERS = { accept: "application/json", "user-agent": "TickSense/0.1" };

// Per-coin cache so adding a coin only fetches that coin, and a rate limit (429) falls back to the last price.
const priceCache = globalThis as {
  __coinPrices?: Record<string, { at: number; usd: number; change24h: number | null }>;
};

export type Quote = { usd: number; change24h: number | null };

export async function getPrices(assets: Asset[]): Promise<Prices> {
  const market = await getMarket(assets);
  return Object.fromEntries(Object.entries(market).map(([symbol, quote]) => [symbol, quote.usd]));
}

/** Price plus 24h % change per symbol, from the same per-coin cache. */
export async function getMarket(assets: Asset[]): Promise<Record<Ticker, Quote>> {
  const cache = (priceCache.__coinPrices ??= {});
  const now = Date.now();
  const stale = assets.filter((asset) => {
    const hit = cache[asset.coingecko_id];
    return !hit || now - hit.at >= TTL_MS;
  });
  if (stale.length) {
    try {
      const fresh = await fetchCoinGecko(stale.map((asset) => asset.coingecko_id));
      for (const [id, quote] of Object.entries(fresh)) cache[id] = { at: now, ...quote };
    } catch (error) {
      if (stale.some((asset) => !cache[asset.coingecko_id])) throw error;
    }
  }
  const market: Record<Ticker, Quote> = {};
  for (const asset of assets) {
    const hit = cache[asset.coingecko_id];
    if (hit) market[asset.symbol] = { usd: hit.usd, change24h: hit.change24h };
  }
  return market;
}

async function fetchCoinGecko(ids: string[]): Promise<Record<string, Quote>> {
  const url = `https://api.coingecko.com/api/v3/simple/price?ids=${ids.map(encodeURIComponent).join(",")}&vs_currencies=usd&include_24hr_change=true`;
  const response = await fetch(url, { headers: HEADERS, cache: "no-store", signal: AbortSignal.timeout(12_000) });
  if (!response.ok) throw new Error(`CoinGecko returned ${response.status}`);
  const body = (await response.json()) as Record<string, { usd?: number; usd_24h_change?: number } | undefined>;
  const quotes: Record<string, Quote> = {};
  for (const id of ids) {
    const usd = Number(body[id]?.usd);
    const change = Number(body[id]?.usd_24h_change);
    if (Number.isFinite(usd) && usd > 0) quotes[id] = { usd, change24h: Number.isFinite(change) ? change : null };
  }
  return quotes;
}

export type CoinResult = Asset & { rank: number | null };

const SEARCH_TTL_MS = 10 * 60_000;
const searchCache = globalThis as { __coinSearch?: Map<string, { at: number; results: CoinResult[] }> };

export async function searchCoins(query: string): Promise<CoinResult[]> {
  const q = query.trim().toLowerCase().slice(0, 40);
  if (!q) return [];
  const cache = (searchCache.__coinSearch ??= new Map());
  const hit = cache.get(q);
  if (hit && Date.now() - hit.at < SEARCH_TTL_MS) return hit.results;

  const response = await fetch(`https://api.coingecko.com/api/v3/search?query=${encodeURIComponent(q)}`, {
    headers: HEADERS,
    cache: "no-store",
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) throw new Error(`CoinGecko search returned ${response.status}`);
  const body = (await response.json()) as {
    coins?: Array<{ id?: string; name?: string; symbol?: string; thumb?: string; market_cap_rank?: number | null }>;
  };
  const results: CoinResult[] = [];
  for (const coin of body.coins ?? []) {
    const symbol = String(coin.symbol ?? "").toUpperCase();
    if (!coin.id || !coin.name || !/^[A-Z0-9]{1,15}$/.test(symbol)) continue;
    results.push({
      symbol,
      coingecko_id: coin.id,
      name: coin.name,
      thumb: coin.thumb?.startsWith("https://") ? coin.thumb : null,
      rank: coin.market_cap_rank ?? null,
    });
    if (results.length === 12) break;
  }
  cache.set(q, { at: Date.now(), results });
  return results;
}

export const CHART_RANGES = ["1h", "1d"] as const;
export type ChartRange = (typeof CHART_RANGES)[number];

export const CHART_RANGE_LABEL: Record<ChartRange, string> = {
  "1h": "1H",
  "1d": "1D",
};

const HOUR_MS = 60 * 60 * 1000;
const HISTORY_TTL_MS = 60_000;

const historyCache = globalThis as {
  __priceHistory?: Record<string, { at: number; points: PricePoint[] }>;
};

export function isChartRange(value: string): value is ChartRange {
  return (CHART_RANGES as readonly string[]).includes(value);
}

export async function getPriceHistory(asset: Asset, range: ChartRange = "1d"): Promise<PricePoint[]> {
  // 1H is the last hour of the same one-day series, so both buttons share one CoinGecko call.
  const series = await loadSeries(asset, HISTORY_TTL_MS);
  const points = selectChartPoints(series, range);
  if (points.length === 0) throw new Error(`CoinGecko returned no ${asset.symbol} price history`);
  return points;
}

async function loadSeries(asset: Asset, ttl: number): Promise<PricePoint[]> {
  const key = `${asset.coingecko_id}:1`;
  const now = Date.now();
  const cached = historyCache.__priceHistory?.[key];
  if (cached && now - cached.at < ttl) return cached.points;

  try {
    const response = await fetch(
      `https://api.coingecko.com/api/v3/coins/${encodeURIComponent(asset.coingecko_id)}/market_chart?vs_currency=usd&days=1`,
      {
        headers: HEADERS,
        cache: "no-store",
        signal: AbortSignal.timeout(12_000),
      },
    );
    if (!response.ok) throw new Error(`CoinGecko history returned ${response.status}`);
    const body = (await response.json()) as { prices?: unknown };
    const points = parseHistory(body.prices);
    if (points.length === 0) throw new Error(`CoinGecko returned no ${asset.symbol} price history`);
    historyCache.__priceHistory = { ...historyCache.__priceHistory, [key]: { at: now, points } };
    return points;
  } catch (error) {
    // Rate limits (429) are common on CoinGecko's free tier; a slightly stale chart beats an empty one.
    if (cached) return cached.points;
    throw error;
  }
}

/** Keep the points that belong in the selected window, then cap the series for the chart. */
export function selectChartPoints(points: PricePoint[], range: ChartRange): PricePoint[] {
  const ordered = [...points].sort((a, b) => a.time - b.time);
  const windowed = range === "1h" ? lastHour(ordered) : ordered;
  return thin(windowed, 400);
}

function lastHour(points: PricePoint[]): PricePoint[] {
  if (points.length === 0) return points;
  const end = points[points.length - 1].time;
  const sliced = points.filter((point) => point.time >= end - HOUR_MS);
  if (sliced.length >= 2) return sliced;
  return points.slice(-2);
}

function parseHistory(value: unknown): PricePoint[] {
  if (!Array.isArray(value)) return [];
  const points: PricePoint[] = [];
  for (const row of value) {
    if (!Array.isArray(row) || row.length < 2) continue;
    const time = Number(row[0]);
    const price = Number(row[1]);
    if (Number.isFinite(time) && Number.isFinite(price) && price > 0) points.push({ time, price });
  }
  return points;
}

function thin(points: PricePoint[], max: number): PricePoint[] {
  if (points.length <= max) return points;
  const step = Math.ceil(points.length / max);
  const sampled = points.filter((_, index) => index % step === 0);
  const last = points[points.length - 1];
  if (sampled[sampled.length - 1]?.time !== last.time) sampled.push(last);
  return sampled;
}
