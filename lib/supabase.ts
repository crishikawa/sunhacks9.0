import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let service: SupabaseClient | undefined;

function supabaseUrl(): string | undefined {
  return process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || undefined;
}

function anonKey(): string | undefined {
  return (
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    undefined
  );
}

export function getServiceClient(): SupabaseClient | null {
  const url = supabaseUrl();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  service ??= createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return service;
}

export function getRealtimeConfig(): { url: string; anonKey: string } | null {
  const url = supabaseUrl();
  const key = anonKey();
  if (!url || !key) return null;
  return { url, anonKey: key };
}

export function sentimentMode(): "grok" | "sample" {
  return process.env.XAI_API_KEY ? "grok" : "sample";
}

export function assertDurableBook(): void {
  if (process.env.VERCEL_ENV === "production" && !getServiceClient()) {
    throw new Error("Production requires Supabase. Memory mode is local only.");
  }
}
