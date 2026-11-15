import { beginRequest, errorMessage, json } from "@/lib/http";
import { getPortfolio } from "@/lib/repository";

export async function GET() {
  await beginRequest();
  try {
    return json(await getPortfolio());
  } catch (error) {
    return json({ error: errorMessage(error) }, 500);
  }
}
