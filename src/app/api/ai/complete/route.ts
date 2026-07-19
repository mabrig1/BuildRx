import { NextResponse } from "next/server";

import { authorizeAiRequest } from "@/lib/ai/route-helpers";
import { getProvider } from "@/lib/ai/providers/registry";
import { AiProviderError } from "@/lib/ai/providers/types";
import { recordAiUsage } from "@/lib/ai/usage";
import { completeSchema } from "@/lib/validations/ai-platform";

export const maxDuration = 120;

/**
 * POST /api/ai/complete — a single completion from any configured
 * provider (NVIDIA, OpenAI, Anthropic, Gemini, DeepSeek, Grok), behind
 * one request/response shape. This is additive: /api/ai/generate,
 * /api/ai/code, and /api/chat are untouched and keep working exactly
 * as before — this route is for the new AI Settings "try it" flow and
 * anything else that needs to target a specific provider by id.
 *
 * Body: { provider, prompt, system?, model?, maxTokens?, temperature?, topP?, stream?, projectId? }
 */
export async function POST(request: Request) {
  const auth = await authorizeAiRequest();
  if (!auth.ok) return auth.response;

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

  const messages = [{ role: "user" as const, content: input.prompt }];
  const options = {
    model: input.model,
    system: input.system,
    maxTokens: input.maxTokens,
    temperature: input.temperature,
    topP: input.topP,
  };
  const startedAt = Date.now();

  try {
    if (!input.stream) {
      const result = await provider.createCompletion(messages, options);
      if (auth.userId) {
        await recordAiUsage({
          userId: auth.userId,
          projectId: input.projectId,
          provider: provider.id,
          model: result.model,
          status: "completed",
          promptTokens: result.usage.promptTokens,
          completionTokens: result.usage.completionTokens,
          durationMs: Date.now() - startedAt,
        });
      }
      return NextResponse.json(
        { text: result.text, model: result.model, provider: provider.id, usage: result.usage },
        { headers: auth.limitHeaders }
      );
    }

    const { stream, completion, model } = await provider.streamCompletion(
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
            provider: provider.id,
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
        "X-Provider": provider.id,
        ...auth.limitHeaders,
      },
    });
  } catch (error) {
    if (auth.userId) {
      await recordAiUsage({
        userId: auth.userId,
        projectId: input.projectId,
        provider: provider.id,
        model: input.model ?? provider.defaultModel(),
        status: "failed",
        promptTokens: 0,
        completionTokens: 0,
        durationMs: Date.now() - startedAt,
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
    if (error instanceof AiProviderError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status >= 500 ? 502 : error.status }
      );
    }
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Completion failed. Please try again.",
      },
      { status: 500 }
    );
  }
}
