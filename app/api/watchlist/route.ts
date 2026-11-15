import { beginRequest, errorMessage, json } from "@/lib/http";
import { addToWatchlist, listWatchlist, removeFromWatchlist } from "@/lib/repository";

export async function GET() {
  await beginRequest();
  try {
    return json({ watchlist: await listWatchlist() });
  } catch (error) {
    return json({ error: errorMessage(error) }, 500);
  }
}

export async function POST(request: Request) {
  await beginRequest();
  try {
    return json({ watchlist: await addToWatchlist(await request.json()) });
  } catch (error) {
    return json({ error: errorMessage(error) }, 400);
  }
}

export async function DELETE(request: Request) {
  await beginRequest();
  try {
    return json({ watchlist: await removeFromWatchlist(new URL(request.url).searchParams.get("symbol") ?? "") });
  } catch (error) {
    return json({ error: errorMessage(error) }, 400);
  }
}
