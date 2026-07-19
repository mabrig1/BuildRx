import { describe, expect, it } from "vitest";

import { estimateMessagesTokens, estimateTokens } from "@/lib/ai/tokens";

describe("estimateTokens", () => {
  it("returns 0 for empty input", () => {
    expect(estimateTokens("")).toBe(0);
  });

  it("estimates roughly one token per 4 characters", () => {
    expect(estimateTokens("a".repeat(400))).toBe(100);
  });

  it("rounds up and never returns 0 for non-empty text", () => {
    expect(estimateTokens("hi")).toBe(1);
  });
});

describe("estimateMessagesTokens", () => {
  it("sums token estimates across messages", () => {
    const total = estimateMessagesTokens([
      { content: "a".repeat(40) },
      { content: "b".repeat(80) },
    ]);
    expect(total).toBe(estimateTokens("a".repeat(40)) + estimateTokens("b".repeat(80)));
  });

  it("returns 0 for an empty message list", () => {
    expect(estimateMessagesTokens([])).toBe(0);
  });
});
