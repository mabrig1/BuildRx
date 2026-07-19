import { NextResponse } from "next/server";

import { authorizeAiRequest } from "@/lib/ai/route-helpers";
import { estimateCost } from "@/lib/ai/pricing";
import { getProvider } from "@/lib/ai/providers/registry";
import { recordAiUsage } from "@/lib/ai/usage";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";
import { compareSchema } from "@/lib/validations/ai-platform";
import type { Json } from "@/types/database";

export const maxDuration = 120;

interface ComparisonResult {
  provider: string;
  model: string;
  text?: string;
  promptTokens?: number;
  completionTokens?: number;
  costUsd?: number | null;
  durationMs: number;
  error?: string;
}

/**
 * POST /api/ai/compare — "model comparison mode": runs the same prompt
 * against 2-6 provider/model pairs in parallel (non-streaming — the UI
 * needs all results at once to lay them out side by side) and returns
 * each with its text, token usage, estimated cost, and latency. One
 * provider failing doesn't fail the others. Persists the run to
 * model_comparisons when signed in.
 *
 * Body: { prompt, system?, targets: [{ provider, model }, …] }
 */
export async function POST(request: Request) {
  const auth = await authorizeAiRequest();
  if (!auth.ok) return auth.response;

  const body = await request.json().catch(() => null);
  const parsed = compareSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid request" },
      { status: 400 }
    );
  }
  const { prompt, system, targets } = parsed.data;
  const messages = [{ role: "user" as const, content: prompt }];

  const results: ComparisonResult[] = await Promise.all(
    targets.map(async (target): Promise<ComparisonResult> => {
      const startedAt = Date.now();
      const provider = getProvider(target.provider);

      if (!provider.isConfigured()) {
        return {
          provider: target.provider,
          model: target.model,
          durationMs: 0,
          error: `${provider.label} isn't configured on this deployment.`,
        };
      }

      try {
        const result = await provider.createCompletion(messages, {
          model: target.model,
          system,
          maxTokens: 1024,
        });
        const durationMs = Date.now() - startedAt;
        const cost = estimateCost(target.provider, target.model, result.usage);

        if (auth.userId) {
          void recordAiUsage({
            userId: auth.userId,
            provider: target.provider,
            model: result.model,
            status: "completed",
            promptTokens: result.usage.promptTokens,
            completionTokens: result.usage.completionTokens,
            durationMs,
            action: "ai_generation",
          }).catch(() => undefined);
        }

        return {
          provider: target.provider,
          model: result.model,
          text: result.text,
          promptTokens: result.usage.promptTokens,
          completionTokens: result.usage.completionTokens,
          costUsd: cost.totalUsd,
          durationMs,
        };
      } catch (error) {
        return {
          provider: target.provider,
          model: target.model,
          durationMs: Date.now() - startedAt,
          error: error instanceof Error ? error.message : "Request failed.",
        };
      }
    })
  );

  if (auth.userId && isSupabaseConfigured()) {
    try {
      const supabase = await createClient();
      await supabase.from("model_comparisons").insert({
        user_id: auth.userId,
        prompt,
        // ComparisonResult is a plain, JSON-serializable object — the
        // cast is just satisfying the generic Json index signature.
        results: results as unknown as Json,
      });
    } catch (error) {
      console.error("Failed to save model comparison:", error);
    }
  }

  return NextResponse.json({ results }, { headers: auth.limitHeaders });
}
