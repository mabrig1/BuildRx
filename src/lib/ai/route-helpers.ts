import { headers } from "next/headers";
import { NextResponse } from "next/server";

import { withTimeout } from "@/lib/health/retry";
import { rateLimit, rateLimitHeaders } from "@/lib/rate-limit";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";

const WINDOW_MS = 60 * 1000;
const DB_STEP_TIMEOUT_MS = 20_000;

function requestsPerMinute() {
  const configured = Number(process.env.NVIDIA_RATE_LIMIT_RPM);
  return Number.isFinite(configured) && configured > 0 ? configured : 20;
}

export type AuthorizedRequest =
  | { ok: true; userId: string | null; limitHeaders: HeadersInit }
  | { ok: false; response: NextResponse };

/**
 * Auth + per-user rate limiting shared by the AI endpoints.
 * Falls back to IP-keyed limiting in demo mode (no Supabase).
 */
export async function authorizeAiRequest(): Promise<AuthorizedRequest> {
  let userId: string | null = null;

  if (isSupabaseConfigured()) {
    const supabase = await createClient();
    try {
      const {
        data: { user },
      } = await withTimeout(
        () => supabase.auth.getUser(),
        DB_STEP_TIMEOUT_MS,
        "auth.getUser"
      );
      if (!user) {
        return {
          ok: false,
          response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
        };
      }
      userId = user.id;
    } catch {
      return {
        ok: false,
        response: NextResponse.json(
          { error: "Authentication is taking too long to respond. Please try again." },
          { status: 504 }
        ),
      };
    }
  }

  // Plan usage limits (monthly AI request quota).
  if (userId) {
    const { checkAiRequestLimit } = await import("@/lib/billing/limits");
    try {
      const limitError = await withTimeout(
        () => checkAiRequestLimit(userId!),
        DB_STEP_TIMEOUT_MS,
        "checkAiRequestLimit"
      );
      if (limitError) {
        return {
          ok: false,
          response: NextResponse.json({ error: limitError }, { status: 402 }),
        };
      }
    } catch {
      return {
        ok: false,
        response: NextResponse.json(
          { error: "Usage check is taking too long to respond. Please try again." },
          { status: 504 }
        ),
      };
    }
  }

  const headerList = await headers();
  const ip =
    headerList.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
  const key = `ai:${userId ?? `ip:${ip}`}`;

  const result = rateLimit(key, {
    limit: requestsPerMinute(),
    windowMs: WINDOW_MS,
  });

  if (!result.success) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Too many requests — please slow down." },
        { status: 429, headers: rateLimitHeaders(result) }
      ),
    };
  }

  return { ok: true, userId, limitHeaders: rateLimitHeaders(result) };
}
