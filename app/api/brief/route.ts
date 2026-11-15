import { buildBrief } from "@/lib/brief";
import { beginRequest, errorMessage, json } from "@/lib/http";
import { getPrices } from "@/lib/prices";
import { getPortfolio, listSignals, listTrades, listWatchlist } from "@/lib/repository";
import { getServiceClient, sentimentMode } from "@/lib/supabase";

export async function GET() {
  await beginRequest();
  try {
    const [portfolio, signals, trades, watchlist] = await Promise.all([
      getPortfolio(),
      listSignals(),
      listTrades(),
      listWatchlist(),
    ]);
    let prices = null;
    try {
      prices = await getPrices(watchlist);
    } catch {
      prices = null;
    }
    return json(
      buildBrief({
        dataMode: getServiceClient() ? "supabase" : "memory",
        sentimentMode: sentimentMode(),
        portfolio,
        prices,
        signals,
        trades,
      }),
    );
  } catch (error) {
    return json({ error: errorMessage(error) }, 500);
  }
}
