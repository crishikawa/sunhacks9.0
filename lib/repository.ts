import { getPrices } from "@/lib/prices";
import { assertDurableBook, getServiceClient } from "@/lib/supabase";
import { decideTrade, planTrade } from "@/lib/trading";
import {
  DEFAULT_PORTFOLIO,
  DEFAULT_WATCHLIST,
  isTicker,
  type Asset,
  type Portfolio,
  type SentimentSignal,
  type SignalDraft,
  type Strategy,
  type Trade,
  type TradeAction,
  type Ticker,
} from "@/types/database";

// The watchlist and holdings tables come from supabase/migrations/002_watchlist_holdings.sql.
// Until that migration runs on the shared Supabase project, this stays false: the desk sticks to
// BTC/ETH/SOL and keeps balances in the original portfolio.btc/eth/sol_holdings columns.
// After running the migration, flip it to true. (In-memory mode always has the full watchlist.)
const WATCHLIST_TABLES = true;
const LEGACY_COLUMNS: Record<string, "btc_holdings" | "eth_holdings" | "sol_holdings"> = {
  BTC: "btc_holdings",
  ETH: "eth_holdings",
  SOL: "sol_holdings",
};
const WATCHLIST_OFF =
  "Adding and removing coins is off until supabase/migrations/002_watchlist_holdings.sql runs on Supabase.";

export function watchlistEnabled(): boolean {
  return WATCHLIST_TABLES || !getServiceClient();
}

type Client = NonNullable<ReturnType<typeof getServiceClient>>;

function writeHolding(client: Client, ticker: string, quantity: number) {
  if (WATCHLIST_TABLES) return client.from("holdings").upsert({ symbol: ticker, quantity }, { onConflict: "symbol" });
  const column = LEGACY_COLUMNS[ticker];
  if (!column) throw new Error(`${ticker} has no balance column before the watchlist migration`);
  return client.from("portfolio").update({ [column]: quantity }).eq("id", 1);
}

type Memory = {
  watchlist: Asset[];
  portfolio: Portfolio;
  signals: SentimentSignal[];
  trades: Trade[];
};

const memory = globalThis as { __desk?: Memory };

function localState(): Memory {
  memory.__desk ??= {
    watchlist: [...DEFAULT_WATCHLIST],
    portfolio: { ...DEFAULT_PORTFOLIO, holdings: {} },
    signals: [],
    trades: [],
  };
  return memory.__desk;
}

let queue: Promise<unknown> = Promise.resolve();

function enqueue<T>(task: () => Promise<T>): Promise<T> {
  const run = queue.then(task, task);
  queue = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}

function assertOk(error: { message: string; code?: string } | null, action: string) {
  if (!error) return;
  if (error.code === "PGRST205" || /schema cache/i.test(error.message)) {
    throw new Error(
      "Supabase is connected, but a table is missing. In the Supabase SQL editor, run supabase/migrations/002_watchlist_holdings.sql (or supabase/schema.sql on a new project), then reload.",
    );
  }
  throw new Error(`${action}: ${error.message}`);
}

function asSignal(row: Record<string, unknown>): SentimentSignal {
  if (!isTicker(row.ticker)) throw new Error("Stored signal has an unknown ticker");
  const action = row.recommended_action;
  if (action !== "BUY" && action !== "SELL" && action !== "HOLD") {
    throw new Error("Stored signal has an unknown action");
  }
  return {
    id: String(row.id),
    ticker: row.ticker,
    sentiment_score: Number(row.sentiment_score),
    confidence: Number(row.confidence),
    summary_catalyst: String(row.summary_catalyst ?? ""),
    recommended_action: action,
    created_at: String(row.created_at),
  };
}

function asTrade(row: Record<string, unknown>): Trade {
  if (!isTicker(row.ticker)) throw new Error("Stored trade has an unknown ticker");
  if (row.action !== "BUY" && row.action !== "SELL") throw new Error("Stored trade has an unknown action");
  return {
    id: String(row.id),
    ticker: row.ticker,
    action: row.action,
    amount_usd: Number(row.amount_usd),
    price_at_execution: Number(row.price_at_execution),
    trigger_signal_id: String(row.trigger_signal_id),
    created_at: String(row.created_at),
  };
}

function asPortfolio(row: Record<string, unknown>, holdingRows: Array<Record<string, unknown>>): Portfolio {
  const holdings: Record<string, number> = {};
  for (const holding of holdingRows) {
    const quantity = Number(holding.quantity);
    if (isTicker(holding.symbol) && quantity > 0) holdings[holding.symbol] = quantity;
  }
  return { id: Number(row.id), cash_balance: Number(row.cash_balance), holdings };
}

function asAsset(row: Record<string, unknown>): Asset {
  if (!isTicker(row.symbol)) throw new Error("Stored watchlist row has an invalid symbol");
  return {
    symbol: row.symbol,
    coingecko_id: String(row.coingecko_id),
    name: String(row.name),
    thumb: typeof row.thumb === "string" ? row.thumb : null,
  };
}

export async function listWatchlist(): Promise<Asset[]> {
  const client = getServiceClient();
  if (!client) return [...localState().watchlist];
  if (!WATCHLIST_TABLES) return [...DEFAULT_WATCHLIST];
  const { data, error } = await client.from("watchlist").select("*").order("added_at", { ascending: true });
  assertOk(error, "Could not load the watchlist");
  return (data ?? []).map((row) => asAsset(row as Record<string, unknown>));
}

export async function addToWatchlist(input: unknown): Promise<Asset[]> {
  const body = input && typeof input === "object" ? (input as Record<string, unknown>) : {};
  const symbol = String(body.symbol ?? "").toUpperCase();
  const coingecko_id = String(body.coingecko_id ?? "");
  const name = String(body.name ?? "").trim().slice(0, 80);
  const thumb = typeof body.thumb === "string" && body.thumb.startsWith("https://") ? body.thumb : null;
  if (!isTicker(symbol)) throw new Error("symbol must be 1-15 letters or digits");
  if (!/^[a-z0-9-]{1,100}$/.test(coingecko_id)) throw new Error("coingecko_id is invalid");
  if (!name) throw new Error("name is required");
  if (!watchlistEnabled()) throw new Error(WATCHLIST_OFF);

  return enqueue(async () => {
    const current = await listWatchlist();
    if (current.some((asset) => asset.coingecko_id === coingecko_id)) return current;
    if (current.some((asset) => asset.symbol === symbol)) {
      throw new Error(`${symbol} is already on your watchlist as a different coin`);
    }
    if (current.length >= 25) throw new Error("The watchlist holds up to 25 coins. Remove one first.");
    const asset: Asset = { symbol, coingecko_id, name, thumb };
    const client = getServiceClient();
    if (!client) {
      localState().watchlist.push(asset);
    } else {
      const { error } = await client.from("watchlist").insert(asset);
      assertOk(error, "Could not add the coin");
    }
    return listWatchlist();
  });
}

export async function removeFromWatchlist(symbol: string): Promise<Asset[]> {
  const ticker = symbol.toUpperCase();
  if (!watchlistEnabled()) throw new Error(WATCHLIST_OFF);
  return enqueue(async () => {
    const portfolio = await getPortfolio();
    if ((portfolio.holdings[ticker] ?? 0) > 0) {
      throw new Error(`You still hold ${ticker}. It can be removed once the auto-trader sells it or you reset the demo.`);
    }
    const client = getServiceClient();
    if (!client) {
      const state = localState();
      state.watchlist = state.watchlist.filter((asset) => asset.symbol !== ticker);
    } else {
      const { error } = await client.from("watchlist").delete().eq("symbol", ticker);
      assertOk(error, "Could not remove the coin");
    }
    return listWatchlist();
  });
}

export async function listSignals(): Promise<SentimentSignal[]> {
  const client = getServiceClient();
  if (!client) return [...localState().signals];
  const { data, error } = await client
    .from("sentiment_signals")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(100);
  assertOk(error, "Could not load signals");
  return (data ?? []).map((row) => asSignal(row as Record<string, unknown>));
}

export async function listTrades(): Promise<Trade[]> {
  const client = getServiceClient();
  if (!client) return [...localState().trades];
  const { data, error } = await client.from("trades").select("*").order("created_at", { ascending: false }).limit(100);
  assertOk(error, "Could not load trades");
  return (data ?? []).map((row) => asTrade(row as Record<string, unknown>));
}

export async function getPortfolio(): Promise<Portfolio> {
  const client = getServiceClient();
  if (!client) {
    const { portfolio } = localState();
    return { ...portfolio, holdings: { ...portfolio.holdings } };
  }
  if (!WATCHLIST_TABLES) {
    const { data, error } = await client.from("portfolio").select("*").eq("id", 1).maybeSingle();
    assertOk(error, "Could not load portfolio");
    if (!data) return insertDefaultPortfolio(client);
    const row = data as Record<string, unknown>;
    return asPortfolio(
      row,
      Object.entries(LEGACY_COLUMNS).map(([symbol, column]) => ({ symbol, quantity: row[column] })),
    );
  }
  const [{ data, error }, { data: holdingRows, error: holdingsError }] = await Promise.all([
    client.from("portfolio").select("id, cash_balance").eq("id", 1).maybeSingle(),
    client.from("holdings").select("symbol, quantity"),
  ]);
  assertOk(error, "Could not load portfolio");
  assertOk(holdingsError, "Could not load holdings");
  if (!data) return insertDefaultPortfolio(client);
  return asPortfolio(data as Record<string, unknown>, (holdingRows ?? []) as Array<Record<string, unknown>>);
}

async function insertDefaultPortfolio(client: Client): Promise<Portfolio> {
  const { data, error } = await client
    .from("portfolio")
    .insert({ id: 1, cash_balance: DEFAULT_PORTFOLIO.cash_balance })
    .select("id, cash_balance")
    .single();
  assertOk(error, "Could not create the portfolio row");
  return asPortfolio(data as Record<string, unknown>, []);
}

export async function resetDemo(): Promise<Portfolio> {
  assertDurableBook();
  return enqueue(async () => {
    const client = getServiceClient();
    if (!client) {
      const state = localState();
      state.portfolio = { ...DEFAULT_PORTFOLIO, holdings: {} };
      state.trades = [];
      return { ...state.portfolio };
    }
    const { error: deleteError } = await client.from("trades").delete().not("id", "is", null);
    assertOk(deleteError, "Could not clear trades");
    if (WATCHLIST_TABLES) {
      const { error: holdingsError } = await client.from("holdings").delete().not("symbol", "is", null);
      assertOk(holdingsError, "Could not clear holdings");
    }
    const legacyZeroes = WATCHLIST_TABLES ? {} : { btc_holdings: 0, eth_holdings: 0, sol_holdings: 0 };
    const { data, error } = await client
      .from("portfolio")
      .upsert({ id: 1, cash_balance: DEFAULT_PORTFOLIO.cash_balance, ...legacyZeroes }, { onConflict: "id" })
      .select("id, cash_balance")
      .single();
    assertOk(error, "Could not reset the portfolio");
    return asPortfolio(data as Record<string, unknown>, []);
  });
}

export async function recordSignal(
  draft: SignalDraft,
  strategy: Strategy,
): Promise<{ signal: SentimentSignal; trade: Trade | null; skippedReason: string | null; portfolio: Portfolio }> {
  return enqueue(() => persist(draft, strategy));
}

async function persist(draft: SignalDraft, strategy: Strategy) {
  const client = getServiceClient();
  if (!client) return persistLocal(draft, strategy);
  return persistSupabase(client, draft, strategy);
}

async function persistLocal(draft: SignalDraft, strategy: Strategy) {
  const state = localState();
  const signal = stampSignal(draft);
  state.signals = [signal, ...state.signals].slice(0, 100);
  const outcome = await settleTrade(signal, state.portfolio, strategy);
  if (outcome.trade && outcome.portfolio) {
    state.portfolio = outcome.portfolio;
    state.trades = [outcome.trade, ...state.trades].slice(0, 100);
  }
  return { signal, trade: outcome.trade, skippedReason: outcome.skippedReason, portfolio: { ...state.portfolio } };
}

async function persistSupabase(
  client: NonNullable<ReturnType<typeof getServiceClient>>,
  draft: SignalDraft,
  strategy: Strategy,
) {
  const { data, error } = await client.from("sentiment_signals").insert(draft).select("*").single();
  assertOk(error, "Could not save the signal");
  const signal = asSignal(data as Record<string, unknown>);
  const current = await getPortfolio();
  const outcome = await settleTrade(signal, current, strategy);
  if (!outcome.trade || !outcome.portfolio) {
    return { signal, trade: null, skippedReason: outcome.skippedReason, portfolio: current };
  }

  const ticker = signal.ticker;
  const { error: updateError } = await client
    .from("portfolio")
    .update({ cash_balance: outcome.portfolio.cash_balance })
    .eq("id", 1);
  assertOk(updateError, "Could not update the portfolio");
  const { error: holdingError } = await writeHolding(client, ticker, outcome.portfolio.holdings[ticker] ?? 0);
  if (holdingError) {
    await client.from("portfolio").update({ cash_balance: current.cash_balance }).eq("id", 1);
    throw new Error(`Could not update holdings: ${holdingError.message}`);
  }

  const { data: tradeRow, error: tradeError } = await client
    .from("trades")
    .insert(tradeInsert(outcome.trade))
    .select("*")
    .single();
  if (tradeError) {
    await client.from("portfolio").update({ cash_balance: current.cash_balance }).eq("id", 1);
    await writeHolding(client, ticker, current.holdings[ticker] ?? 0);
    throw new Error(`Could not save the trade: ${tradeError.message}`);
  }
  return {
    signal,
    trade: asTrade(tradeRow as Record<string, unknown>),
    skippedReason: null,
    portfolio: outcome.portfolio,
  };
}

async function settleTrade(
  signal: SentimentSignal,
  portfolio: Portfolio,
  strategy: Strategy,
): Promise<{ trade: Trade | null; skippedReason: string | null; portfolio: Portfolio | null }> {
  const decision = decideTrade(signal, strategy);
  if ("reason" in decision) return { trade: null, skippedReason: decision.reason, portfolio: null };

  let prices;
  try {
    const asset = (await listWatchlist()).find((item) => item.symbol === signal.ticker);
    if (!asset) return { trade: null, skippedReason: `${signal.ticker} is no longer on the watchlist`, portfolio: null };
    prices = await getPrices([asset]);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Price request failed";
    return { trade: null, skippedReason: message, portfolio: null };
  }
  const planned = planTrade(signal, portfolio, prices, strategy);
  if ("reason" in planned) return { trade: null, skippedReason: planned.reason, portfolio: null };
  const trade: Trade = {
    id: crypto.randomUUID(),
    ticker: planned.plan.ticker,
    action: planned.plan.action,
    amount_usd: planned.plan.amount_usd,
    price_at_execution: planned.plan.price_at_execution,
    trigger_signal_id: signal.id,
    created_at: new Date().toISOString(),
  };
  return { trade, skippedReason: null, portfolio: planned.plan.portfolio };
}

function stampSignal(draft: SignalDraft): SentimentSignal {
  return { ...draft, id: crypto.randomUUID(), created_at: new Date().toISOString() };
}

function tradeInsert(trade: Trade) {
  return {
    ticker: trade.ticker satisfies Ticker,
    action: trade.action satisfies TradeAction,
    amount_usd: trade.amount_usd,
    price_at_execution: trade.price_at_execution,
    trigger_signal_id: trade.trigger_signal_id,
  };
}
