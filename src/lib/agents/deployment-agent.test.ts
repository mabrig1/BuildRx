import { beforeEach, describe, expect, it, vi } from "vitest";
import { deploymentAgent } from "./deployment-agent";
import type { AgentEvent, WorkflowContext } from "./types";
const calls = vi.hoisted(() => ({ updates: [] as Array<Record<string, unknown>> }));
vi.mock("@/lib/agents/checks", () => ({ checksPass: () => true, runStaticChecks: () => [] }));
vi.mock("@/lib/agents/llm", () => ({ pause: async () => {} }));
vi.mock("@/lib/agents/tools", () => ({ verifyPreviewResponds: async () => ({ ok: true, detail: "Saved HTML read" }) }));
vi.mock("@/lib/files/manager", () => ({ getFileSystem: () => ({ writeMany: async () => {} }) }));
vi.mock("@/lib/ai/nvidia", () => ({ isNvidiaConfigured: () => false }));
vi.mock("@/lib/ai/openrouter", () => ({ isOpenRouterConfigured: () => true }));
vi.mock("@/lib/ai/provider", () => ({ isAnyProviderConfigured: () => true }));
vi.mock("@/lib/supabase/config", () => ({ isSupabaseConfigured: () => true }));
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({ from: () => ({ update: (value: Record<string, unknown>) => { calls.updates.push(value); return { eq: async () => ({ error: null }) }; }, insert: async () => ({ error: null }) }) }) }));
function context(): WorkflowContext {
  return { projectId: "owner-project", userId: "owner", persist: true, prompt: "Build a statistics workstation", files: new Map(["PRODUCT-BRIEF", "ARCHITECTURE-DECISION", "RELEASE-CHECKLIST", "OPERATIONS-RUNBOOK"].map(name => { const path = `docs/${name}.md`; return [path, { path, content: "evidence" }]; })), plan: { appName: "Statistics", summary: "Research", pages: [], components: [], features: [], dataModel: [] } };
}
beforeEach(() => { calls.updates.length = 0; });
describe("verification respects generation failures", () => {
  it("never marks a fallback-generated product ready even when source checks pass", async () => {
    const ctx = context();ctx.generationBlockers = [{ agent: "planner", message: "provider token limit" }];
    const events: AgentEvent[] = [];
    await deploymentAgent.run(ctx, event => events.push(event));
    expect(ctx.verificationPassed).toBe(false);
    expect(calls.updates[0]).toMatchObject({ status: "error" });
    const verification = events.find(event => event.type === "verification");
    expect(verification).toMatchObject({ items: expect.arrayContaining([expect.objectContaining({ label: "Essential generation completed", status: "fail" })]) });
  });
  it("describes passing static evidence without claiming runtime deployment", async () => {
    const ctx = context();const events: AgentEvent[] = [];
    await deploymentAgent.run(ctx, event => events.push(event));
    expect(ctx.verificationPassed).toBe(true);
    expect(events.at(-1)).toMatchObject({ message: expect.stringMatching(/runtime build and user workflows still need testing/) });
    expect(JSON.stringify(events)).not.toContain("Deployed and verified");
  });
});
