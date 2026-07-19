import { NextResponse } from "next/server";

import { isNvidiaConfigured, NvidiaApiError } from "@/lib/ai/nvidia";
import { generateImage } from "@/lib/ai/image";
import { authorizeAiRequest } from "@/lib/ai/route-helpers";
import { recordAiUsage } from "@/lib/ai/usage";
import { generateImageSchema } from "@/lib/validations/ai";

export const maxDuration = 90;

/**
 * POST /api/ai/image — text-to-image generation (hero art, icons,
 * placeholders) for apps being built, via an NVIDIA visual-GenAI NIM.
 *
 * Body: { prompt, negativePrompt?, aspectRatio?, seed?, projectId? }
 */
export async function POST(request: Request) {
  const auth = await authorizeAiRequest();
  if (!auth.ok) return auth.response;

  if (!isNvidiaConfigured()) {
    return NextResponse.json(
      { error: "NVIDIA API is not configured — set NVIDIA_API_KEY." },
      { status: 503 }
    );
  }

  const body = await request.json().catch(() => null);
  const parsed = generateImageSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid request" },
      { status: 400 }
    );
  }
  const input = parsed.data;
  const startedAt = Date.now();

  try {
    const result = await generateImage({
      prompt: input.prompt,
      negativePrompt: input.negativePrompt,
      aspectRatio: input.aspectRatio,
      seed: input.seed,
    });

    if (auth.userId) {
      await recordAiUsage({
        userId: auth.userId,
        projectId: input.projectId,
        model: result.model,
        status: "completed",
        promptTokens: 0,
        completionTokens: 0,
        durationMs: Date.now() - startedAt,
      });
    }

    return NextResponse.json(
      { imageDataUrl: result.imageDataUrl, model: result.model },
      { headers: auth.limitHeaders }
    );
  } catch (error) {
    if (auth.userId) {
      await recordAiUsage({
        userId: auth.userId,
        projectId: input.projectId,
        model: "image",
        status: "failed",
        promptTokens: 0,
        completionTokens: 0,
        durationMs: Date.now() - startedAt,
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
    if (error instanceof NvidiaApiError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status >= 500 ? 502 : error.status }
      );
    }
    return NextResponse.json(
      { error: "Image generation failed. Please try again." },
      { status: 500 }
    );
  }
}
