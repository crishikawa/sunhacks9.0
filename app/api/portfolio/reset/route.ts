import { beginRequest, errorMessage, json } from "@/lib/http";
import { assertDeskSecret, deskEnv, DeskAuthError } from "@/lib/desk-secret";
import { resetDemo } from "@/lib/repository";

export async function POST(request: Request) {
  await beginRequest();
  try {
    assertDeskSecret(request.headers.get("x-desk-secret"), deskEnv());
  } catch (error) {
    if (error instanceof DeskAuthError) return json({ error: "Unauthorized" }, 401);
    return json({ error: errorMessage(error) }, 401);
  }
  try {
    return json({ portfolio: await resetDemo() });
  } catch (error) {
    return json({ error: errorMessage(error) }, 500);
  }
}
