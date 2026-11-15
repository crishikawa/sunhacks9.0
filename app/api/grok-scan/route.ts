import { beginRequest, errorMessage, json } from "@/lib/http";
import { assertDeskSecret, DeskAuthError } from "@/lib/desk-secret";
import { runScan } from "@/lib/scan";

function rejectLocked(request: Request): Response | null {
  try {
    assertDeskSecret(request.headers.get("x-desk-secret"), {
      secret: process.env.DESK_ADMIN_SECRET,
      production: process.env.VERCEL_ENV === "production",
    });
    return null;
  } catch (error) {
    if (error instanceof DeskAuthError) return json({ error: "Unauthorized" }, 401);
    return json({ error: errorMessage(error) }, 401);
  }
}

export async function POST(request: Request) {
  await beginRequest();
  const locked = rejectLocked(request);
  if (locked) return locked;
  let body: unknown = {};
  const text = await request.text();
  if (text.trim()) {
    try {
      body = JSON.parse(text) as unknown;
    } catch {
      return json({ error: "Request body must be JSON" }, 400);
    }
  }

  try {
    const result = await runScan(body);
    const saved = result.results.some((item) => item.signal);
    if (!saved && result.results.some((item) => item.error)) {
      return json({ error: result.results.map((item) => item.error).filter(Boolean).join(" "), results: result.results }, 502);
    }
    return json(result);
  } catch (error) {
    return json({ error: errorMessage(error) }, 400);
  }
}
