import { NextResponse } from "next/server";
import { z } from "zod";

import { getProvider } from "@/lib/ai/providers/registry";
import { recordAiUsage } from "@/lib/ai/usage";
import { requireContentUser } from "@/lib/content/access";
import { generateContentPiece } from "@/lib/content/ai";
import { providerIdSchema } from "@/lib/validations/ai-platform";
import { contentInputsSchema } from "@/lib/validations/content";
import type { Json } from "@/types/database";

export const maxDuration = 180;

type RouteParams = { params: Promise<{ contentId: string }> };

const regenerateSchema = z.object({
  inputs: contentInputsSchema.optional(),
  provider: providerIdSchema.optional(),
  model: z.string().max(120).optional(),
});

/**
 * POST /api/content/[contentId]/regenerate — re-runs generation,
 * optionally with updated inputs/provider/model (defaults to what the
 * piece was created with). Overwrites title/content in place.
 */
export async function POST(request: Request, { params }: RouteParams) {
  const auth = await requireContentUser();
  if (!auth.ok) return auth.response;
  const { contentId } = await params;

  const existing = await auth.supabase
    .from("content_pieces")
    .select("*")
    .eq("id", contentId)
    .eq("owner_id", auth.userId)
    .maybeSingle();
  if (!existing.data) {
    return NextResponse.json({ error: "Content not found" }, { status: 404 });
  }

  const body = await request.json().catch(() => ({}));
  const parsed = regenerateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid request" },
      { status: 400 }
    );
  }

  const providerId = parsed.data.provider ?? existing.data.provider;
  const inputs = parsed.data.inputs ?? (existing.data.inputs as Record<string, unknown>);
  const provider = getProvider(providerId);
  if (!provider.isConfigured()) {
    return NextResponse.json(
      { error: `${provider.label} isn't configured on this deployment.` },
      { status: 503 }
    );
  }

  const startedAt = Date.now();
  try {
    const generated = await generateContentPiece({
      providerId,
      model: parsed.data.model,
      type: existing.data.type,
      inputs,
    });

    const { data, error } = await auth.supabase
      .from("content_pieces")
      .update({
        title: generated.title,
        content: generated.content,
        inputs: inputs as unknown as Json,
        provider: providerId,
        model: generated.model,
        status: "ready",
        error: null,
      })
      .eq("id", contentId)
      .select("*")
      .single();
    if (error || !data) {
      return NextResponse.json(
        { error: error?.message ?? "Failed to save regenerated content" },
        { status: 500 }
      );
    }

    await recordAiUsage({
      userId: auth.userId,
      provider: providerId,
      model: generated.model,
      status: "completed",
      promptTokens: 0,
      completionTokens: 0,
      durationMs: Date.now() - startedAt,
      action: "ai_generation",
    });

    return NextResponse.json({ content: data });
  } catch (error) {
    await recordAiUsage({
      userId: auth.userId,
      provider: providerId,
      model: parsed.data.model ?? provider.defaultModel(),
      status: "failed",
      promptTokens: 0,
      completionTokens: 0,
      durationMs: Date.now() - startedAt,
      error: error instanceof Error ? error.message : "Unknown error",
      action: "ai_generation",
    });
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Regeneration failed." },
      { status: 502 }
    );
  }
}
