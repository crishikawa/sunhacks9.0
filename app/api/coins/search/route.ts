import { beginRequest, errorMessage, json } from "@/lib/http";
import { searchCoins } from "@/lib/prices";

export async function GET(request: Request) {
  await beginRequest();
  try {
    return json({ results: await searchCoins(new URL(request.url).searchParams.get("q") ?? "") });
  } catch (error) {
    return json({ error: errorMessage(error), results: [] }, 502);
  }
}
