import { beginRequest, errorMessage, json } from "@/lib/http";
import { listTrades } from "@/lib/repository";

export async function GET() {
  await beginRequest();
  try {
    return json(await listTrades());
  } catch (error) {
    return json({ error: errorMessage(error) }, 500);
  }
}
