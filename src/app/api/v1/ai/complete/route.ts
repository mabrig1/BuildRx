import { NextResponse } from "next/server";

import { authenticateApiKey } from "@/lib/api-keys/auth";
import { checkAiRequestLimitForApiKey } from "@/lib/api-keys/quota";
import { getProvider } from "@/lib/ai/providers/registry";
import { AiProviderError } from "@/lib/ai/providers/types";
import { recordAiUsage } from "@/lib/ai/usage";
import { rateLimit, rateLimitHeaders } from "@/lib/rate-limit";
import { createAdminClient } from "@/lib/supabase/admin";
import { completeSchema } from "@/lib/validations/ai-platform";

export const maxDuration = 120;

/**
 * POST /api/v1/ai/complete — programmatic access to the same
 * multi-provider completion engine behind /api/ai/complete, for
 * anyone building against the platform with an API key instead of a
 * browser session. Same request/response shape; no streaming (a
 * simpler contract for external HTTP clients — the session-based
 * route still supports it).
 *
 * Body: { provider, prompt, system?, model?, maxTokens?, temperature?, topP? }
 */
export async function POST(request: Request) {
  const identity = await authenticateApiKey(request);
  if (!identity) {
    return NextResponse.json({ error: "Invalid or missing API key" }, { status: 401 });
  }

  const limit = rateLimit(`v1-ai:${identity.keyId}`, { limit: 20, windowMs: 60_000 });
  if (!limit.success) {
    return NextResponse.json(
      { error: "Too many requests — please slow down." },
      { status: 429, headers: rateLimitHeaders(limit) }
    );
  }

  const admin = createAdminClient();
  const quotaError = await checkAiRequestLimitForApiKey(admin, identity.userId);
  if (quotaError) {
    return NextResponse.json({ error: quotaError }, { status: 402 });
  }

  const body = await request.json().catch(() => null);
  const parsed = completeSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid request" },
      { status: 400 }
    );
  }
  const input = parsed.data;
  const provider = getProvider(input.provider);
  if (!provider.isConfigured()) {
    return NextResponse.json(
      { error: `${provider.label} isn't configured on this deployment.` },
      { status: 503 }
    );
  }

  const startedAt = Date.now();
  try {
    const result = await provider.createCompletion(
      [{ role: "user", content: input.prompt }],
      {
        model: input.model,
        system: input.system,
        maxTokens: input.maxTokens,
        temperature: input.temperature,
        topP: input.topP,
      }
    );

    await recordAiUsage({
      userId: identity.userId,
      provider: provider.id,
      model: result.model,
      status: "completed",
      promptTokens: result.usage.promptTokens,
      completionTokens: result.usage.completionTokens,
      durationMs: Date.now() - startedAt,
    });

    return NextResponse.json(
      { text: result.text, model: result.model, provider: provider.id, usage: result.usage },
      { headers: rateLimitHeaders(limit) }
    );
  } catch (error) {
    await recordAiUsage({
      userId: identity.userId,
      provider: provider.id,
      model: input.model ?? provider.defaultModel(),
      status: "failed",
      promptTokens: 0,
      completionTokens: 0,
      durationMs: Date.now() - startedAt,
      error: error instanceof Error ? error.message : "Unknown error",
    });
    if (error instanceof AiProviderError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status >= 500 ? 502 : error.status }
      );
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Completion failed. Please try again." },
      { status: 500 }
    );
  }
}
