import { NextResponse } from "next/server";

import { isNvidiaConfigured, NvidiaApiError } from "@/lib/ai/nvidia";
import { extractDocument } from "@/lib/ai/parse";
import { authorizeAiRequest } from "@/lib/ai/route-helpers";
import { recordAiUsage } from "@/lib/ai/usage";
import { parseDocumentSchema } from "@/lib/validations/ai";

export const maxDuration = 60;

/**
 * POST /api/ai/parse — structured text/data extraction from an image
 * (spec doc, annotated mockup, screenshot of a form) via Nemotron Parse.
 *
 * Body: { imageDataUrl, prompt?, projectId? }
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
  const parsed = parseDocumentSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid request" },
      { status: 400 }
    );
  }
  const input = parsed.data;
  const startedAt = Date.now();

  try {
    const result = await extractDocument({
      imageDataUrl: input.imageDataUrl,
      prompt: input.prompt,
    });

    if (auth.userId) {
      await recordAiUsage({
        userId: auth.userId,
        projectId: input.projectId,
        model: result.model,
        status: "completed",
        promptTokens: result.usage.promptTokens,
        completionTokens: result.usage.completionTokens,
        durationMs: Date.now() - startedAt,
      });
    }

    return NextResponse.json(
      { text: result.text, model: result.model, usage: result.usage },
      { headers: auth.limitHeaders }
    );
  } catch (error) {
    if (auth.userId) {
      await recordAiUsage({
        userId: auth.userId,
        projectId: input.projectId,
        model: "parse",
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
      { error: "Document parsing failed. Please try again." },
      { status: 500 }
    );
  }
}
