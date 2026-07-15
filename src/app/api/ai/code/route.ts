import { NextResponse } from "next/server";

import {
  createChatCompletion,
  isNvidiaConfigured,
  NvidiaApiError,
  nvidiaCodeModel,
  streamChatCompletion,
  type NvidiaMessage,
} from "@/lib/ai/nvidia";
import { authorizeAiRequest } from "@/lib/ai/route-helpers";
import { recordAiUsage } from "@/lib/ai/usage";
import { generateCodeSchema } from "@/lib/validations/ai";

export const maxDuration = 120;

function codeSystemPrompt(language?: string) {
  return [
    "You are an expert software engineer generating production-quality code.",
    language
      ? `Write the code in ${language}.`
      : "Infer the most appropriate language from the request.",
    "Respond with the code in a single fenced code block with a language tag.",
    "Add brief comments only where the logic is non-obvious.",
    "If the request is ambiguous, choose sensible defaults instead of asking questions, and note assumptions in a short comment at the top.",
  ].join(" ");
}

/**
 * POST /api/ai/code — code generation via the NVIDIA Inference API,
 * using a code-specialized model.
 *
 * Body: { prompt, language?, context?, projectId?, stream? }
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
  const parsed = generateCodeSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid request" },
      { status: 400 }
    );
  }
  const input = parsed.data;

  const userContent = input.context
    ? `Existing code for context:\n\n${input.context}\n\n---\n\n${input.prompt}`
    : input.prompt;

  const messages: NvidiaMessage[] = [
    { role: "system", content: codeSystemPrompt(input.language) },
    { role: "user", content: userContent },
  ];
  const options = {
    model: nvidiaCodeModel(),
    maxTokens: 4096,
    temperature: 0.2, // low temperature for deterministic code
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
        model: nvidiaCodeModel(),
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
      { error: "Code generation failed. Please try again." },
      { status: 500 }
    );
  }
}
