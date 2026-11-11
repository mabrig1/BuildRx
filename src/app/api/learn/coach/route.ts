import { NextResponse } from "next/server";

import { completeText, isAnyProviderConfigured } from "@/lib/ai/provider";
import { authorizeAiRequest } from "@/lib/ai/route-helpers";
import { recordAiUsage } from "@/lib/ai/usage";
import { coachMessages, validateCoachRequest } from "@/lib/learn/coach";
import { isSupabaseConfigured } from "@/lib/supabase/config";

export const maxDuration = 120;

/**
 * POST /api/learn/coach — opt-in lesson or five-day mini-course from a
 * whitelisted BuildRx knowledge topic. Does not accept arbitrary documents,
 * execute code, change projects, or fetch provider credentials.
 *
 * AI tutor is account-only in production and uses the existing shared plan
 * quota + safety/rate guard; without live auth or provider, offline lessons
 * remain available on /learn (no fake AI lesson or generated output).
 */
export async function POST(request: Request) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json(
      { error: "AI coaching needs a configured sign-in service. The offline lessons are still available." },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }

  const auth = await authorizeAiRequest();
  if (!auth.ok) return auth.response;
  if (!auth.userId) {
    return NextResponse.json({ error: "Sign in to create AI training." }, { status: 401 });
  }

  const raw = await request.json().catch(() => null);
  const validated = validateCoachRequest(raw);
  if (!validated.ok) {
    return NextResponse.json(
      { error: validated.error },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }
  if (!isAnyProviderConfigured()) {
    return NextResponse.json(
      { error: "AI lessons are unavailable because no AI provider is configured. The verified knowledge base remains available." },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }

  const startedAt = Date.now();
  const userId = auth.userId;
  try {
    const result = await completeText(
      coachMessages(validated.lesson, validated.request),
      { maxTokens: 1900, temperature: 0.35, timeoutMs: 85_000 },
    );
    if (!result.text.trim()) throw new Error("Empty training response");
    await recordAiUsage({
      userId,
      model: result.provider,
      status: "completed",
      promptTokens: result.usage.promptTokens,
      completionTokens: result.usage.completionTokens,
      durationMs: Date.now() - startedAt,
      action: "ai_generation",
    });

    return NextResponse.json(
      {
        lessonId: validated.lesson.id,
        mode: validated.request.mode,
        text: result.text.slice(0, 18_000),
        provider: result.provider,
        verified: false,
        generated: true,
        notice: "AI-generated teaching, not verification of your project or a replacement for official documentation.",
      },
      { headers: { ...auth.limitHeaders, "Cache-Control": "no-store" } },
    );
  } catch {
    await recordAiUsage({
      userId,
      model: "training-provider",
      status: "failed",
      promptTokens: 0,
      completionTokens: 0,
      durationMs: Date.now() - startedAt,
      error: "Training generation failed",
      action: "ai_generation",
    });
    return NextResponse.json(
      { error: "The AI tutor could not complete this training. Use the offline lesson, or try again when the provider is available." },
      { status: 502, headers: { "Cache-Control": "no-store" } },
    );
  }
}
