type Env = Record<string, string | undefined>;

/**
 * Public demo mode. With DEMO_MODE=true the app makes no paid or stateful calls:
 * no xAI requests (sample sentiment and desk-data chat), no Supabase (the book lives
 * in server memory), and the desk secret is optional. Safe to leave on a public URL.
 */
export function isDemoMode(env: Env = process.env): boolean {
  return env.DEMO_MODE?.trim().toLowerCase() === "true";
}

/** The xAI key, or undefined in demo mode so no request can ever be billed. */
export function xaiApiKey(env: Env = process.env): string | undefined {
  if (isDemoMode(env)) return undefined;
  return env.XAI_API_KEY || undefined;
}
