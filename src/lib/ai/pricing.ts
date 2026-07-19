/**
 * Cost estimation, built on top of each provider's own model catalog
 * (see providers/*.ts `models()` — pricing lives there, next to the
 * model IDs it describes, instead of a second table that could drift
 * out of sync).
 */

import { getProvider } from "@/lib/ai/providers/registry";
import type { AiProviderId, AiUsage } from "@/lib/ai/providers/types";

export interface CostEstimate {
  /** USD. Null when the model's pricing isn't known (e.g. NVIDIA's free tier, or an unlisted model). */
  totalUsd: number | null;
  inputUsd: number | null;
  outputUsd: number | null;
}

export function estimateCost(
  providerId: AiProviderId,
  modelId: string,
  usage: AiUsage
): CostEstimate {
  const model = getProvider(providerId)
    .models()
    .find((m) => m.id === modelId);

  if (!model?.pricing) {
    return { totalUsd: null, inputUsd: null, outputUsd: null };
  }

  const inputUsd = (usage.promptTokens / 1_000_000) * model.pricing.inputPer1M;
  const outputUsd =
    (usage.completionTokens / 1_000_000) * model.pricing.outputPer1M;

  return {
    inputUsd: round(inputUsd),
    outputUsd: round(outputUsd),
    totalUsd: round(inputUsd + outputUsd),
  };
}

function round(usd: number): number {
  return Math.round(usd * 1_000_000) / 1_000_000;
}
