import type { PostgrestError } from "@supabase/supabase-js";

/**
 * Log a Supabase/Postgres error with its full diagnostic fields
 * (code, details, hint are dropped by `error.message` alone), and
 * return a user-facing description that names the actual cause
 * instead of a generic "something went wrong".
 */
export function reportDbError(
  context: string,
  error: PostgrestError
): string {
  console.error(`[db] ${context} failed`, {
    code: error.code,
    message: error.message,
    details: error.details,
    hint: error.hint,
  });

  switch (error.code) {
    case "42501":
      // Table-privilege or RLS rejection.
      return (
        "The database rejected this action (permission denied). " +
        "This is a server configuration problem, not something you did — " +
        "please try again later or contact support."
      );
    case "23503":
      // Foreign-key violation, e.g. missing public.users profile row.
      return (
        "Your account profile is incomplete on the server. " +
        "Sign out and back in; if the problem persists, contact support."
      );
    default:
      return error.message;
  }
}
