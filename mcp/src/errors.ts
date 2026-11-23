// Turns errors from Supabase (PostgREST, Auth, network) into short, actionable text
// that Claude can show to the user. Never leaks stack traces or SQL.

export class UserFacingError extends Error {}

type MaybePostgrest = { code?: string; message?: string; details?: string; hint?: string };

export function toUserMessage(err: unknown): string {
  if (err instanceof UserFacingError) return err.message;

  const e = (err ?? {}) as MaybePostgrest & { name?: string; status?: number };

  // Network: Supabase not running / wrong URL (plain fetch errors and Auth's retryable fetch errors)
  if (e.name === "AuthRetryableFetchError" || (err instanceof Error && /fetch failed|ECONNREFUSED/i.test(err.message))) {
    return "Can't reach Supabase. Is it running (`npm run db:start`) and is RECAPWELL_SUPABASE_URL correct?";
  }

  // supabase-js Auth errors
  if (e.name === "AuthApiError" || e.name === "AuthWeakPasswordError") {
    return e.message?.includes("Invalid login credentials")
      ? "Couldn't sign in to Recapwell: wrong RECAPWELL_EMAIL or RECAPWELL_PASSWORD."
      : `Couldn't sign in to Recapwell: ${e.message}`;
  }

  switch (e.code) {
    case "22P02": // invalid_text_representation, e.g. a malformed uuid
      return "That id isn't in the right format.";
    case "42501":
      return "You don't have permission to do that in this workspace.";
    case "PGRST301":
    case "PGRST303":
      return "Your Recapwell session expired. Restart the MCP server to sign in again.";
    case "P0001":
    case "P0002":
      return e.message ?? "The database refused this request.";
  }

  return `Recapwell returned an error${e.message ? `: ${e.message}` : "."}`;
}
