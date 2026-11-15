import { beginRequest, errorMessage, json } from "@/lib/http";
import { getPrices } from "@/lib/prices";
import { listWatchlist } from "@/lib/repository";

export async function GET() {
  await beginRequest();
  try {
    return json(await getPrices(await listWatchlist()));
  } catch (error) {
    return json({ error: errorMessage(error) }, 502);
  }
}
