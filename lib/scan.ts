import { analyzeTicker } from "@/lib/grok";
import { getPortfolio, listWatchlist, recordSignal } from "@/lib/repository";
import { assertDurableBook } from "@/lib/supabase";
import { parseStrategy, parseTickers } from "@/lib/trading";
import type { ScanResponse, ScanTickerResult, SentimentSource } from "@/types/database";

export async function runScan(input: unknown): Promise<ScanResponse> {
  assertDurableBook();
  const watchlist = await listWatchlist();
  const tickers = parseTickers(
    input,
    watchlist.map((asset) => asset.symbol),
  );
  const strategy = parseStrategy(input);
  await getPortfolio();
  const results: ScanTickerResult[] = [];

  for (const ticker of tickers) {
    let source: SentimentSource = "grok";
    try {
      const asset = watchlist.find((item) => item.symbol === ticker)!;
      const analysis = await analyzeTicker(asset);
      source = analysis.source;
      const saved = await recordSignal(analysis.draft, strategy);
      results.push({
        ticker,
        source,
        signal: saved.signal,
        trade: saved.trade,
        skippedReason: saved.skippedReason,
        error: null,
      });
    } catch (error) {
      results.push({
        ticker,
        source,
        signal: null,
        trade: null,
        skippedReason: null,
        error: error instanceof Error ? error.message : "Scan failed",
      });
    }
  }

  const portfolio = await getPortfolio();
  return { results, portfolio };
}
