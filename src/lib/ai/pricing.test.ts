import { describe, expect, it } from "vitest";

import { nvidiaTextModel } from "@/lib/ai/nvidia";
import { estimateCost } from "@/lib/ai/pricing";

describe("estimateCost", () => {
  it("computes input/output/total cost for a known model", () => {
    // gpt-4o-mini: $0.15 / 1M input, $0.60 / 1M output.
    const cost = estimateCost("openai", "gpt-4o-mini", {
      promptTokens: 1_000_000,
      completionTokens: 1_000_000,
    });
    expect(cost.inputUsd).toBeCloseTo(0.15, 6);
    expect(cost.outputUsd).toBeCloseTo(0.6, 6);
    expect(cost.totalUsd).toBeCloseTo(0.75, 6);
  });

  it("returns nulls for an unrecognized model", () => {
    const cost = estimateCost("openai", "not-a-real-model", {
      promptTokens: 1000,
      completionTokens: 1000,
    });
    expect(cost.totalUsd).toBeNull();
    expect(cost.inputUsd).toBeNull();
    expect(cost.outputUsd).toBeNull();
  });

  it("returns null (unpriced, free tier) for NVIDIA's configured model", () => {
    // NVIDIA's catalog entry deliberately has no `pricing` field.
    const cost = estimateCost("nvidia", nvidiaTextModel(), {
      promptTokens: 1000,
      completionTokens: 1000,
    });
    expect(cost.totalUsd).toBeNull();
  });

  it("scales linearly with token count", () => {
    const small = estimateCost("openai", "gpt-4o", {
      promptTokens: 1000,
      completionTokens: 0,
    });
    const large = estimateCost("openai", "gpt-4o", {
      promptTokens: 2000,
      completionTokens: 0,
    });
    expect(large.inputUsd).toBeCloseTo((small.inputUsd ?? 0) * 2, 6);
  });
});
