import { NextResponse } from "next/server";

import { isNvidiaConfigured, NvidiaApiError } from "@/lib/ai/nvidia";
import { generateProjectPlan } from "@/lib/ai/plan";
import { authorizeAiRequest } from "@/lib/ai/route-helpers";
import { recordAiUsage } from "@/lib/ai/usage";
import { planSchema } from "@/lib/validations/ai";

export const maxDuration = 90;

/**
 * POST /api/ai/plan — turns a feature request into a structured,
 * multi-file build plan (via the long-context planning model) before
 * any code is generated.
 *
 * Body: { prompt, context?, projectId? }
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
  const parsed = planSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid request" },
      { status: 400 }
    );
  }
  const input = parsed.data;
  const startedAt = Date.now();

  try {
    const { plan, model, usage } = await generateProjectPlan({
      prompt: input.prompt,
      context: input.context,
    });

    if (auth.userId) {
      await recordAiUsage({
        userId: auth.userId,
        projectId: input.projectId,
        model,
        status: "completed",
        promptTokens: usage.promptTokens,
        completionTokens: usage.completionTokens,
        durationMs: Date.now() - startedAt,
      });
    }

    return NextResponse.json({ plan, model }, { headers: auth.limitHeaders });
  } catch (error) {
    if (auth.userId) {
      await recordAiUsage({
        userId: auth.userId,
        projectId: input.projectId,
        model: "plan",
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
      { error: "Build planning failed. Please try again." },
      { status: 500 }
    );
  }
}
