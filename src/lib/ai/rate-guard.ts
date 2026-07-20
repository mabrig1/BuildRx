import { NextResponse } from "next/server";

import { rateLimit, rateLimitHeaders } from "@/lib/rate-limit";

const WINDOW_MS = 60 * 1000;

function requestsPerMinute() {
  const configured = Number(process.env.NVIDIA_RATE_LIMIT_RPM);
  return Number.isFinite(configured) && configured > 0 ? configured : 20;
}

export type AiUsageGuardResult =
  | { ok: true; limitHeaders: HeadersInit }
  | { ok: false; response: NextResponse };

/**
 * Monthly-quota + per-minute rate limiting for AI-cost routes that do
 * their own owner-scoped auth (Content Studio, Document AI, RAG,
 * Workflows) rather than going through authorizeAiRequest() in
 * route-helpers.ts, which already covers this for the original
 * /api/ai/* and /api/agents/run routes. Those newer features called
 * providers directly and never wired into either the billing quota or
 * the rate limiter — this closes that gap with one shared check.
 */
export async function enforceAiUsageLimits(
  userId: string,
  scope: string
): Promise<AiUsageGuardResult> {
  const { checkAiRequestLimit } = await import("@/lib/billing/limits");
  const limitError = await checkAiRequestLimit(userId);
  if (limitError) {
    return {
      ok: false,
      response: NextResponse.json({ error: limitError }, { status: 402 }),
    };
  }

  const result = rateLimit(`ai:${scope}:${userId}`, {
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

  return { ok: true, limitHeaders: rateLimitHeaders(result) };
}
