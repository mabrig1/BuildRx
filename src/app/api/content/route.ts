import { NextResponse } from "next/server";

import { getProvider } from "@/lib/ai/providers/registry";
import { enforceAiUsageLimits } from "@/lib/ai/rate-guard";
import { recordAiUsage } from "@/lib/ai/usage";
import { requireContentUser } from "@/lib/content/access";
import { generateContentPiece } from "@/lib/content/ai";
import { contentTypeSchema, createContentSchema } from "@/lib/validations/content";

export const maxDuration = 180;

/**
 * GET /api/content — the caller's own generated content, newest first
 * (optionally ?type=blog_post to filter). Excludes the full `content`
 * body — fetch one piece for that.
 *
 * POST /api/content — generate a new piece. Body: { type, inputs,
 * provider, model? }. Ebooks take noticeably longer (outline + a
 * chapter-by-chapter loop, see lib/content/ai.ts) — maxDuration is set
 * generously to cover that.
 */
export async function GET(request: Request) {
  const auth = await requireContentUser();
  if (!auth.ok) return auth.response;

  const { searchParams } = new URL(request.url);
  const typeParam = contentTypeSchema.safeParse(searchParams.get("type"));

  let query = auth.supabase
    .from("content_pieces")
    .select("id, type, title, status, error, created_at, updated_at")
    .eq("owner_id", auth.userId)
    .order("created_at", { ascending: false });
  if (typeParam.success) query = query.eq("type", typeParam.data);

  const { data, error } = await query;
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ content: data });
}

export async function POST(request: Request) {
  const auth = await requireContentUser();
  if (!auth.ok) return auth.response;

  const guard = await enforceAiUsageLimits(auth.userId, "content");
  if (!guard.ok) return guard.response;

  const body = await request.json().catch(() => null);
  const parsed = createContentSchema.safeParse(body);
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
    const generated = await generateContentPiece({
      providerId: input.provider,
      model: input.model,
      type: input.type,
      inputs: input.inputs,
    });

    const { data, error } = await auth.supabase
      .from("content_pieces")
      .insert({
        owner_id: auth.userId,
        type: input.type,
        title: generated.title,
        inputs: input.inputs,
        content: generated.content,
        status: "ready",
        provider: input.provider,
        model: generated.model,
      })
      .select("*")
      .single();
    if (error || !data) {
      return NextResponse.json(
        { error: error?.message ?? "Failed to save generated content" },
        { status: 500 }
      );
    }

    await recordAiUsage({
      userId: auth.userId,
      provider: input.provider,
      model: generated.model,
      status: "completed",
      promptTokens: 0,
      completionTokens: 0,
      durationMs: Date.now() - startedAt,
      action: "ai_generation",
    });

    return NextResponse.json({ content: data }, { status: 201 });
  } catch (error) {
    await recordAiUsage({
      userId: auth.userId,
      provider: input.provider,
      model: input.model ?? provider.defaultModel(),
      status: "failed",
      promptTokens: 0,
      completionTokens: 0,
      durationMs: Date.now() - startedAt,
      error: error instanceof Error ? error.message : "Unknown error",
      action: "ai_generation",
    });
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Generation failed." },
      { status: 502 }
    );
  }
}
