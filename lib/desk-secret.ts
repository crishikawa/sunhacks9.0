import { isDemoMode } from "./demo";

export class DeskAuthError extends Error {
  readonly status = 401;
}

export function assertDeskSecret(
  header: string | null,
  env: { secret: string | undefined; production: boolean },
): void {
  if (!env.secret) {
    if (env.production) throw new DeskAuthError("Unauthorized");
    return;
  }
  if (header !== env.secret) throw new DeskAuthError("Unauthorized");
}

/** Settings for assertDeskSecret. Demo mode spends nothing, so it does not require a secret. */
export function deskEnv(env: Record<string, string | undefined> = process.env): {
  secret: string | undefined;
  production: boolean;
} {
  return {
    secret: env.DESK_ADMIN_SECRET || undefined,
    production: env.VERCEL_ENV === "production" && !isDemoMode(env),
  };
}
