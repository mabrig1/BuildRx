import { NextResponse } from "next/server";

import {
  createChatCompletion,
  isNvidiaConfigured,
  NvidiaApiError,
  streamChatCompletion,
  type NvidiaMessage,
} from "@/lib/ai/nvidia";
import { authorizeAiRequest } from "@/lib/ai/route-helpers";
import { recordAiUsage } from "@/lib/ai/usage";
import { generateTextSchema } from "@/lib/validations/ai";

export const maxDuration = 120;

/**
 * POST /api/ai/generate — text generation via the NVIDIA Inference API.
 *
 * Body: { prompt, system?, projectId?, model?, maxTokens?, temperature?, topP?, seed?, stream? }
 * Streams text deltas by default; set stream:false for a JSON response.
 */
/** Temporary deployment check — confirms the route is live. */
export async function GET() {
  return Response.json({
    status: "API is working",
  });
}

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
  const parsed = generateTextSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid request" },
      { status: 400 }
    );
  }
  const input = parsed.data;

  const messages: NvidiaMessage[] = [
    ...(input.system
      ? [{ role: "system" as const, content: input.system }]
      : []),
    { role: "user" as const, content: input.prompt },
  ];
  const options = {
    model: input.model,
    maxTokens: input.maxTokens,
    temperature: input.temperature,
    topP: input.topP,
    seed: input.seed,
  };

  const startedAt = Date.now();

  try {
    if (!input.stream) {
      const result = await createChatCompletion(messages, options);
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
    }

    const { stream, completion, model } = await streamChatCompletion(
      messages,
      options
    );

    if (auth.userId) {
      const userId = auth.userId;
      void completion
        .then((result) =>
          recordAiUsage({
            userId,
            projectId: input.projectId,
            model: result.model,
            status: "completed",
            promptTokens: result.usage.promptTokens,
            completionTokens: result.usage.completionTokens,
            durationMs: Date.now() - startedAt,
          })
        )
        .catch(() => undefined);
    }

    return new Response(stream, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "X-Model": model,
        ...auth.limitHeaders,
      },
    });
  } catch (error) {
    if (auth.userId) {
      await recordAiUsage({
        userId: auth.userId,
        projectId: input.projectId,
        model: options.model ?? "nvidia",
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
      { error: "Text generation failed. Please try again." },
      { status: 500 }
    );
  }
}
