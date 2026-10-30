/**
 * Supabase/PostgREST errors are plain objects ({ message, details, hint, code }),
 * not `Error` instances, so `err instanceof Error` is false for them and
 * `String(err)` collapses to the useless "[object Object]" - which is what
 * every SetupNotice/error banner in this app was showing instead of the
 * actual DB error.
 */
export function errorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (err && typeof err === "object" && "message" in err && typeof err.message === "string") {
    return err.message;
  }
  if (typeof err === "string") return err;
  try {
    return JSON.stringify(err);
  } catch {
    return String(err);
  }
}
