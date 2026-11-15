import { beginRequest, errorMessage, json } from "@/lib/http";
import { listSignals } from "@/lib/repository";

export async function GET() {
  await beginRequest();
  try {
    return json(await listSignals());
  } catch (error) {
    return json({ error: errorMessage(error) }, 500);
  }
}
