import { beforeEach, describe, expect, it, vi } from "vitest";
import { founderOpsAgent } from "./founder-ops-agent";
import type { AgentEvent, AppPlan, WorkflowContext } from "./types";

const spy = vi.hoisted(() => ({
  enabled: vi.fn(), budget: vi.fn(), model: vi.fn(), write: vi.fn(),
}));
vi.mock("@/lib/agents/llm", async importOriginal => {
  const actual = await importOriginal<typeof import("@/lib/agents/llm")>();
  return {
    ...actual, canCallModel: spy.enabled, stepBudgetMs: spy.budget,
    runAgentCompletion: spy.model, pause: async () => {},
  };
});
vi.mock("@/lib/agents/tools", () => ({
  writeFile: spy.write,
}));
const plan: AppPlan = {
  appName: "SupportFlow",
  summary: "Private ticket support and verified status updates",
  userRoles: [{ name: "Support manager", permissions: ["manage tickets"] }],
  workflows: [{
    name: "Resolve ticket", actor: "Support manager",
    steps: ["Open", "Review", "Update", "Save"],
    outcome: "A ticket can be closed and reopened with saved resolution",
  }],
  pages: [{ name: "Dashboard", path: "/", description: "Ticket dashboard" }],
  components: [],
  dataModel: [{ table: "tickets", description: "Ticket records", columns: [{ name: "id", type: "uuid" }] }],
  features: ["Ticket status", "Admin dashboard"],
};
function context(): WorkflowContext {
  return {
    projectId: "test-project", userId: "owner-id",
    prompt: "Build a secure ticket system", persist: false,
    files: new Map(), plan,
  };
}
function events() {
  const all: AgentEvent[] = [];
  const emit = (event: AgentEvent) => { all.push(event); };
  return { all, emit };
}
beforeEach(() => {
  vi.resetAllMocks();
  spy.enabled.mockReturnValue(true);
  spy.budget.mockReturnValue(45_000);
  spy.model.mockResolvedValue(JSON.stringify({
    smallestValuableOutcome: "A support manager can safely resolve a real ticket",
    acceptanceCriteria: ["The ticket status persists after a refresh"],
  }));
  spy.write.mockImplementation((c: WorkflowContext, path: string, content: string) => {
    c.files.set(path, { path, content });
  });
});

describe("FounderOps central-provider model integration", () => {
  it("uses one bounded shared-provider request and preserves approval gates", async () => {
    const c = context(); const { all, emit } = events();
    await founderOpsAgent.run(c, emit);
    expect(spy.model).toHaveBeenCalledOnce();
    expect(spy.model).toHaveBeenCalledWith(expect.objectContaining({
      role: "light", maxTokens: 1200, timeoutMs: 45_000,
    }));
    expect(c.founderOpsSource).toBe("agent");
    expect(c.files.size).toBe(4);
    expect(c.founderOps?.humanApprovals.some(item => item.includes("Approve"))).toBe(true);
    expect(all.some(event => event.type === "agent_degraded")).toBe(false);
  });
  it("preserves a complete contract and provides a classified rate-limit failure", async () => {
    spy.model.mockRejectedValueOnce(new Error("HTTP 429 rate limit"));
    const c = context(); const { all, emit } = events();
    await founderOpsAgent.run(c, emit);
    expect(c.founderOpsSource).toBe("deterministic");
    expect(c.files.size).toBe(4);
    const failure = all.find(event => event.type === "agent_degraded");
    expect(failure?.type).toBe("agent_degraded");
    if(failure?.type === "agent_degraded") {
      expect(failure.code).toBe("AI_RATE_LIMITED");
      expect(failure.suggestedFix.length).toBeGreaterThan(10);
    }
  });
  it("skips optional model work when the time slice is too small for it", async () => {
    spy.budget.mockReturnValue(7_000);
    const c = context(); const { all, emit } = events();
    await founderOpsAgent.run(c, emit);
    expect(spy.model).not.toHaveBeenCalled();
    expect(c.files.size).toBe(4);
    expect(all.some(event => event.type === "agent_degraded")).toBe(false);
  });
  it("reports malformed model output without mislabelling it as AI-authored", async () => {
    spy.model.mockResolvedValueOnce("not JSON");
    const c = context(); const { all, emit } = events();
    await founderOpsAgent.run(c, emit);
    expect(c.founderOpsSource).toBe("deterministic");
    const error = all.find(event => event.type === "agent_degraded");
    if(error?.type !== "agent_degraded") throw new Error("Expected classified model diagnostic");
    expect(error.code).toBe("AI_EMPTY_OUTPUT");
    expect(c.files.size).toBe(4);
  });
});
