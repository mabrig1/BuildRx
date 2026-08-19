import { NextResponse } from "next/server";

import { logError } from "@/lib/health/logger";
import type { DiagnosedError, Subsystem } from "@/lib/health/types";

/** Loosely matches a Supabase/PostgREST error without importing its type. */
interface PostgrestLikeError {
  code: string;
  message: string;
  details?: string | null;
  hint?: string | null;
}

function isPostgrestLikeError(error: unknown): error is PostgrestLikeError {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    "message" in error &&
    typeof (error as { code: unknown }).code === "string"
  );
}

const POSTGRES_ERROR_MAP: Record<
  string,
  { code: string; cause: string; suggestedFix: string; retryable?: boolean }
> = {
  "42P01": {
    code: "DB_RELATION_MISSING",
    cause: "A required database table or view does not exist.",
    suggestedFix:
      "Open Admin → Health and approve the auto-generated migration to create the missing table.",
  },
  "42501": {
    code: "DB_PERMISSION_DENIED",
    cause: "The database rejected this action (permission denied) — a role grant or RLS policy is missing.",
    suggestedFix:
      "Check Admin → Health → Database for a grant-repair proposal, or verify table privileges were not stripped by a prior migration.",
  },
  "23503": {
    code: "DB_FK_VIOLATION",
    cause: "A referenced row is missing — most often an incomplete user profile (public.users) for a signed-in account.",
    suggestedFix: "Sign out and back in; if this persists, contact support.",
  },
  "23505": {
    code: "DB_UNIQUE_VIOLATION",
    cause: "A row with this unique value already exists.",
    suggestedFix: "Use a different value, or check whether this action already succeeded.",
  },
  "28P01": {
    code: "DB_AUTH_FAILED",
    cause: "The database rejected the server's credentials.",
    suggestedFix: "Verify SUPABASE_SERVICE_ROLE_KEY / DATABASE_URL are current in the deployment environment.",
  },
  "08006": {
    code: "DB_UNREACHABLE",
    cause: "The database connection was lost or refused.",
    suggestedFix: "Retry shortly; if this persists, check the Supabase project status page.",
    retryable: true,
  },
  "08001": {
    code: "DB_UNREACHABLE",
    cause: "Could not establish a database connection.",
    suggestedFix: "Retry shortly; if this persists, check the Supabase project status page.",
    retryable: true,
  },
  "3D000": {
    code: "DB_MISSING",
    cause: "The configured database does not exist.",
    suggestedFix: "Verify NEXT_PUBLIC_SUPABASE_URL points at the correct project.",
  },
  PGRST301: {
    code: "AUTH_SESSION_EXPIRED",
    cause: "The user's session token has expired.",
    suggestedFix: "Sign in again.",
  },
};

/** Turns any thrown value into a structured, user-facing diagnosis. */
export function classifyThrown(error: unknown, subsystemHint?: Subsystem): DiagnosedError {
  // Postgres/Supabase errors carry the most actionable detail.
  if (isPostgrestLikeError(error)) {
    const mapped = POSTGRES_ERROR_MAP[error.code];
    if (mapped) {
      return {
        message: `${mapped.cause} (${error.code})`,
        code: mapped.code,
        subsystem: "database",
        cause: `${error.message}${error.hint ? ` — hint: ${error.hint}` : ""}`,
        suggestedFix: mapped.suggestedFix,
        retryable: mapped.retryable ?? false,
      };
    }
    return {
      message: `Database error (${error.code}): ${error.message}`,
      code: "DB_ERROR",
      subsystem: "database",
      cause: error.message,
      suggestedFix: "Check Admin → Health → Database, or review the Supabase logs for this error code.",
      retryable: false,
    };
  }

  const message = error instanceof Error ? error.message : String(error);
  const status =
    typeof error === "object" && error !== null && "status" in error
      ? Number((error as { status?: unknown }).status)
      : undefined;

  const errorName =
    typeof error === "object" && error !== null && "name" in error
      ? String((error as { name?: unknown }).name)
      : undefined;
  if (errorName === "AbortError" || /timed? ?out|deadline exceeded/i.test(message)) {
    return {
      message: "The AI took too long to respond and the request was stopped.",
      code: "AI_TIMEOUT",
      subsystem: "ai",
      cause: message,
      suggestedFix: "Try a shorter or more specific request — very large responses can exceed the time limit.",
      retryable: true,
    };
  }

  // Anthropic billing errors arrive as a 400, so they'd otherwise fall
  // through to the generic bad-request branch. Only reachable when the
  // opt-in Anthropic tier is enabled — the fix is to turn it back off.
  if (/credit balance is too low|billing|insufficient_quota/i.test(message)) {
    return {
      message: "The optional Anthropic fallback has no credit left.",
      code: "AI_PROVIDER_BILLING",
      subsystem: "ai",
      cause: message,
      suggestedFix:
        "Remove ANTHROPIC_ENABLED (or set it to false) to run on NVIDIA's free models only, or top up the Anthropic account.",
      retryable: false,
    };
  }

  if (/unauthori[sz]ed|not authenticated|jwt|no session/i.test(message)) {
    return {
      message: "You need to be signed in to do that.",
      code: "AUTH_UNAUTHORIZED",
      subsystem: "auth",
      cause: message,
      suggestedFix: "Sign in and try again. If this keeps happening, check Admin → Health → Auth.",
      retryable: false,
    };
  }

  if (status !== undefined && status >= 500) {
    return {
      message: `The AI provider is temporarily unavailable (${status}).`,
      code: "AI_PROVIDER_ERROR",
      subsystem: "api",
      cause: message,
      suggestedFix: "This is usually transient — retry in a moment. Check Admin → Health → AI services if it continues.",
      retryable: true,
    };
  }
  if (status !== undefined && (status === 401 || status === 403)) {
    return {
      message: "The AI provider rejected the configured API key.",
      code: "AI_PROVIDER_AUTH",
      subsystem: "api",
      cause: message,
      suggestedFix: "Verify NVIDIA_API_KEY is set and valid in the deployment environment (get a free key at https://build.nvidia.com).",
      retryable: false,
    };
  }
  if (status !== undefined && status === 429) {
    return {
      message: "The AI provider is rate-limiting requests right now.",
      code: "AI_PROVIDER_RATE_LIMITED",
      subsystem: "api",
      cause: message,
      suggestedFix: "Wait a few seconds and try again.",
      retryable: true,
    };
  }

  if (/fetch failed|ECONNREFUSED|ENOTFOUND|network|ETIMEDOUT/i.test(message)) {
    return {
      message: "A network call to an external service failed.",
      code: "NETWORK_ERROR",
      subsystem: subsystemHint ?? "api",
      cause: message,
      suggestedFix: "Usually transient — retry. If persistent, check Admin → Health for the affected service.",
      retryable: true,
    };
  }

  return {
    message: message || "An unexpected error occurred.",
    code: "UNKNOWN_ERROR",
    subsystem: subsystemHint ?? "api",
    cause: message,
    suggestedFix: "Check Admin → Health → Error history for the full stack trace.",
    retryable: false,
  };
}

/** Maps a diagnosed error's code to an HTTP status. */
function statusForCode(code: string): number {
  if (code === "AUTH_UNAUTHORIZED") return 401;
  if (code === "AI_PROVIDER_AUTH") return 401;
  if (code === "AI_PROVIDER_RATE_LIMITED") return 429;
  if (code === "DB_PERMISSION_DENIED") return 403;
  if (code.startsWith("DB_") || code.startsWith("AI_") || code === "NETWORK_ERROR") return 502;
  return 500;
}

/**
 * Wraps a Next.js route handler so uncaught errors are classified,
 * logged with full context (Debug Agent), and returned as a structured
 * response instead of a bare 500 / generic message.
 */
export function withApiErrorHandling<
  Args extends unknown[],
  Handler extends (...args: Args) => Promise<Response>,
>(source: string, handler: Handler, subsystemHint?: Subsystem): Handler {
  return (async (...args: Args) => {
    try {
      return await handler(...args);
    } catch (error) {
      const diagnosed = classifyThrown(error, subsystemHint);
      await logError(source, diagnosed.message, {
        code: diagnosed.code,
        subsystem: diagnosed.subsystem,
        stack: error instanceof Error ? error.stack : undefined,
        context: { cause: diagnosed.cause },
      });
      return NextResponse.json(
        {
          error: diagnosed.message,
          code: diagnosed.code,
          subsystem: diagnosed.subsystem,
          cause: diagnosed.cause,
          suggestedFix: diagnosed.suggestedFix,
        },
        { status: statusForCode(diagnosed.code) }
      );
    }
  }) as Handler;
}
