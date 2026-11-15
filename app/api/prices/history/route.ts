import { beginRequest, errorMessage, json } from "@/lib/http";
import { getPriceHistory, isChartRange } from "@/lib/prices";
import { listWatchlist } from "@/lib/repository";

export async function GET(request: Request) {
  await beginRequest();
  const url = new URL(request.url);
  const ticker = (url.searchParams.get("ticker") ?? "").toUpperCase();
  const range = url.searchParams.get("range") ?? "1d";
  if (!isChartRange(range)) return json({ error: "Unknown chart range" }, 400);
  try {
    const asset = (await listWatchlist()).find((item) => item.symbol === ticker);
    if (!asset) return json({ error: `${ticker || "That coin"} is not on the watchlist` }, 400);
    return json({ ticker, range, points: await getPriceHistory(asset, range) });
  } catch (error) {
    return json({ error: errorMessage(error) }, 502);
  }
}
