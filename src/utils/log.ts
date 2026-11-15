/** Tiny stderr logger for swallowed-but-meaningful failures. `warn` always prints; `debug` needs DOSSIER_DEBUG=1. */
function describe(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

export function warn(scope: string, err: unknown): void {
  console.warn(`[${new Date().toISOString()}] WARN ${scope}: ${describe(err)}`);
}

export function debug(scope: string, err: unknown): void {
  if (process.env.DOSSIER_DEBUG === "1" || process.env.DOSSIER_DEBUG === "true") {
    console.warn(`[${new Date().toISOString()}] DEBUG ${scope}: ${describe(err)}`);
  }
}
