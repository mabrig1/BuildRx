import { NextResponse } from "next/server";
import { z } from "zod";

import { generateImage } from "@/lib/ai/image";
import { isNvidiaConfigured, NvidiaApiError } from "@/lib/ai/nvidia";
import { enforceAiUsageLimits } from "@/lib/ai/rate-guard";
import { requireContentUser } from "@/lib/content/access";

export const maxDuration = 90;

type RouteParams = { params: Promise<{ contentId: string }> };

const coverImageSchema = z.object({
  prompt: z.string().min(1).max(2000).optional(),
});

/**
 * POST /api/content/[contentId]/cover-image — generates a cover image
 * for the piece via the existing NVIDIA image-generation pipeline
 * (src/lib/ai/image.ts — not rebuilt here) and saves it on the piece.
 */
export async function POST(request: Request, { params }: RouteParams) {
  const auth = await requireContentUser();
  if (!auth.ok) return auth.response;

  const guard = await enforceAiUsageLimits(auth.userId, "content-cover-image");
  if (!guard.ok) return guard.response;

  const { contentId } = await params;

  if (!isNvidiaConfigured()) {
    return NextResponse.json(
      { error: "NVIDIA API is not configured — set NVIDIA_API_KEY." },
      { status: 503 }
    );
  }

  const existing = await auth.supabase
    .from("content_pieces")
    .select("title, type")
    .eq("id", contentId)
    .eq("owner_id", auth.userId)
    .maybeSingle();
  if (!existing.data) {
    return NextResponse.json({ error: "Content not found" }, { status: 404 });
  }

  const body = await request.json().catch(() => ({}));
  const parsed = coverImageSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid request" },
      { status: 400 }
    );
  }

  try {
    const result = await generateImage({
      prompt:
        parsed.data.prompt?.trim() ||
        `A clean, professional cover image for a piece titled "${existing.data.title}".`,
      aspectRatio: "16:9",
    });

    const { error } = await auth.supabase
      .from("content_pieces")
      .update({ cover_image_data_url: result.imageDataUrl })
      .eq("id", contentId);
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ coverImageDataUrl: result.imageDataUrl });
  } catch (error) {
    if (error instanceof NvidiaApiError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status >= 500 ? 502 : error.status }
      );
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Image generation failed." },
      { status: 502 }
    );
  }
}
