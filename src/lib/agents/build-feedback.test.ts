import { describe, expect, it } from "vitest";
import { appendApprovedFeedback, containsCredential, feedbackInputSchema } from "@/lib/agents/build-feedback";

const valid = {
  projectId: "f7c5a360-bad4-4f4c-b2c6-32c1130d995a",
  rating: 4,
  note: "The submit button fails after saving.",
};

describe("BuildRx feedback boundaries", () => {
  it("accepts owner-scopable bounded feedback and rejects oversized/unexpected fields", () => {
    expect(feedbackInputSchema.safeParse(valid).success).toBe(true);
    expect(feedbackInputSchema.safeParse({ ...valid, rating: 6 }).success).toBe(false);
    expect(feedbackInputSchema.safeParse({ ...valid, note: "x".repeat(900) }).success).toBe(false);
    expect(feedbackInputSchema.safeParse({ ...valid, apiKey: "secret" }).success).toBe(false);
  });
  it("rejects common credential patterns before persistence", () => {
    expect(containsCredential("key is sk-" + "A".repeat(28))).toBe(true);
    expect(containsCredential("bearer " + "a".repeat(22))).toBe(true);
    expect(containsCredential(valid.note)).toBe(false);
  });
  it("includes feedback only after the user chooses to apply it", () => {
    const prompt = "Create a working appointment scheduler.";
    expect(appendApprovedFeedback(prompt, "")).toBe(prompt);
    const revised = appendApprovedFeedback(prompt, valid.note);
    expect(revised).toContain("USER-APPROVED FEEDBACK");
    expect(revised).toContain(valid.note);
    expect(revised).toContain(prompt);
    expect(appendApprovedFeedback(prompt, "nvapi-" + "x".repeat(30))).toBe(prompt);
  });
});
