import { describe, expect, it } from "vitest";
import { toCustomerBuildEvent } from "@/lib/agents/public-progress";
import type { AgentEvent } from "@/lib/agents/types";

describe("customer build progress", () => {
  it("keeps degraded status without leaking the provider error", () => {
    const input: AgentEvent = {
      type: "agent_degraded",
      agent: "founder_ops",
      message: "FounderOps model pass failed",
      code: "AI_NO_CREDIT",
      cause: "You requested 4000 tokens, only 2111 available. https://openrouter.ai/settings/credits",
      suggestedFix: "Top up OPENROUTER_API_KEY",
      retryable: false,
    };
    const result = toCustomerBuildEvent(input);
    expect(result.type).toBe("agent_degraded");
    expect(JSON.stringify(result)).toContain("starter components");
    expect(JSON.stringify(result)).not.toMatch(/openrouter|4000|2111|OPENROUTER_API_KEY|Top up|FounderOps/i);
  });

  it("removes raw errors and tokens from failed steps", () => {
    const input: AgentEvent = {
      type: "error",
      agent: "coding",
      message: "Provider 402: token budget exhausted",
      cause: "OPENROUTER_API_KEY=private",
      suggestedFix: "Visit the billing dashboard",
    };
    const result = toCustomerBuildEvent(input);
    expect(JSON.stringify(result)).not.toMatch(/402|private|OPENROUTER|billing/i);
    expect(result.type).toBe("error");
  });

  it("does not expose arbitrary untrusted logs", () => {
    const result = toCustomerBuildEvent({
      type: "agent_log",
      agent: "ui",
      message: "secret model output: abc",
    });
    expect(JSON.stringify(result)).not.toContain("secret");
  });

  it("preserves verified completion status", () => {
    const input: AgentEvent = {
      type: "workflow_complete",
      previewUrl: null,
      fileCount: 26,
      verificationPassed: false,
    };
    expect(toCustomerBuildEvent(input)).toEqual(input);
  });

  it("redacts untrusted verification details", () => {
    const result = toCustomerBuildEvent({
      type: "verification",
      agent: "qa",
      items: [{ label: "Build checks", status: "fail", detail: "API KEY=secret" }],
    });
    expect(JSON.stringify(result)).not.toContain("secret");
  });
});
