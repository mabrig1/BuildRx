import { headers } from "next/headers";
import { NextResponse } from "next/server";

import { rateLimit, rateLimitHeaders } from "@/lib/rate-limit";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";

const WINDOW_MS = 60 * 1000;

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
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return {
        ok: false,
        response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
      };
    }
    userId = user.id;
  }

  // Plan usage limits (monthly AI request quota).
  if (userId) {
    const { checkAiRequestLimit } = await import("@/lib/billing/limits");
    const limitError = await checkAiRequestLimit(userId);
    if (limitError) {
      return {
        ok: false,
        response: NextResponse.json({ error: limitError }, { status: 402 }),
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
