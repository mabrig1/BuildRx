import { describe, it, expect } from "vitest";
import { customerVisibleAssistantMessage } from "@/lib/agents/legacy-build-message";

describe("legacy build report presentation", () => {
  it("hides historical OpenRouter error details from customer chat", () => {
    const raw = "✅ **Security Agent** — checked files. ⚠️ **Debugging Agent** — Why: OpenRouter credit balance is exhausted. Fix: set OPENROUTER_MODEL. ❌ Verification failed; coding used a fallback.";
    const visible = customerVisibleAssistantMessage(raw);
    expect(visible).toContain("Previous build needs attention");
    expect(visible).not.toMatch(/OpenRouter|OPENROUTER_MODEL|credit balance|Debugging Agent/);
  });

  it("does not misclassify ordinary assistant explanations", () => {
    const explanation = "The Debugging Agent will examine any errors in your app.";
    expect(customerVisibleAssistantMessage(explanation)).toBe(explanation);
  });

  it("retains successful customer-readable build logs", () => {
    const transcript = "✅ Designing your screens — complete. ✅ Saving your preview — complete.";
    expect(customerVisibleAssistantMessage(transcript)).toBe(transcript);
  });
});
