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
