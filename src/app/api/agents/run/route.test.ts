import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "./route";
import { GET as getPreview } from "@/app/api/preview/[projectId]/route";
import { getFileSystem } from "@/lib/files/manager";
import * as orchestrator from "@/lib/agents/orchestrator";
import { fallbackPlan } from "@/lib/agents/planner";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";
import { verifyPreviewResponds } from "@/lib/agents/tools";
import type { AgentEvent } from "@/lib/agents/types";

const session = vi.hoisted(() => ({ userId: null as string | null }));
vi.mock("@/lib/ai/route-helpers", () => ({
  authorizeAiRequest: async () => ({ ok: true, userId: session.userId, limitHeaders: {} }),
}));
vi.mock("@/lib/supabase/config", () => ({ isSupabaseConfigured: vi.fn(() => false) }));
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/agents/llm", async importOriginal => ({
  ...await importOriginal<typeof import("@/lib/agents/llm")>(),
  canCallModel: () => false,
  isLlmConfigured: () => false,
  pause: async () => {},
}));

function build(projectId: string, prompt: string) {
  return POST(new Request("https://buildrx.test/api/agents/run", {
    method: "POST", body: JSON.stringify({ projectId, prompt }),
  }));
}

async function events(response: Response): Promise<AgentEvent[]> {
  expect(response.status).toBe(200);
  return (await response.text()).trim().split("\n").map(line => JSON.parse(line));
}

beforeEach(() => {
  vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://anonymous-probe.invalid");
  vi.stubGlobal("fetch", vi.fn(() => { throw new Error("Unexpected external request"); }));
});
afterEach(() => { session.userId = null; vi.restoreAllMocks(); vi.mocked(isSupabaseConfigured).mockReturnValue(false); vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

describe("build and repair through the workspace endpoints", () => {
  it("builds a project, serves its saved preview, and accepts Repair after reload", async () => {
    const id = "workspace-build-repair";
    const fresh = await events(await build(id, "Build a simple task tracker for a small team"));
    expect(fresh.at(-1)).toMatchObject({ type: "workflow_complete", verificationPassed: true });
    const preview = await getPreview(new Request("https://buildrx.test"), {
      params: Promise.resolve({ projectId: id }),
    });
    expect(preview.status).toBe(200);
    expect(preview.headers.get("Cache-Control")).toContain("private");
    expect(await preview.text()).toMatch(/<body[\s>]/i);

    const fs = getFileSystem(id);
    const originalPage = await fs.read("src/app/page.tsx");
    const edited = originalPage!.content + "\n// User customization\n";
    await fs.write({ path: "src/app/page.tsx", content: edited });
    const retried = await events(await build(id, "Repair"));
    expect(retried[0]).toMatchObject({
      type: "workflow_start", agents: ["planner", "security", "qa", "repair", "deployment"],
    });
    expect(retried.at(-1)).toMatchObject({ type: "workflow_complete", verificationPassed: true });
    expect((await fs.read("src/app/page.tsx"))?.content).toBe(edited);
    expect(fetch).not.toHaveBeenCalled();
  }, 30_000);

  it("loads a private project's saved build plan even after chat history is gone", async () => {
    session.userId = "owner";
    const projectId = "private-repair";
    const prompt = "Build a CRM for customer relationships";
    const plan = fallbackPlan(prompt);
    const files = [{ path: "src/app/page.tsx", content: "existing source" }];
    vi.mocked(isSupabaseConfigured).mockReturnValue(true);
    const db = {
      from(table: string) {
        const values = { projects: { id: projectId }, project_files: files,
          chat_messages: { metadata: { kind: "build-result", prompt, plan } } };
        const data = values[table as keyof typeof values];
        const terminal = async () => ({ data, error: null });
        const query = {
          select: () => query, eq: () => query, contains: () => query, order: () => query,
          limit: () => table === "project_files" ? terminal() : query,
          single: terminal, maybeSingle: terminal,
        };
        return query;
      },
    };
    vi.mocked(createClient).mockResolvedValue(db as never);
    const run = vi.spyOn(orchestrator, "runWorkflow").mockResolvedValueOnce(undefined);
    const response = await build(projectId, "Repair");
    await response.text();
    expect(response.status).toBe(200);
    expect(run).toHaveBeenCalledWith(expect.objectContaining({
      projectId, prompt, plan: expect.objectContaining({ appName: plan.appName, pages: plan.pages }),
      repairSnapshot: new Map(files.map(file => [file.path, file.content])),
    }), expect.any(Function));
  });

  it("rejects ordinary short requests and a contextless retry without starting a build", async () => {
    expect((await build("empty", "abc")).status).toBe(400);
    expect((await build("empty", "Repair")).status).toBe(422);
    expect((await build("empty", "Retry")).status).toBe(422);
  });

  it("never passes a demo placeholder, missing file or malformed preview", async () => {
    expect((await verifyPreviewResponds("demo-empty")).ok).toBe(false);
    const fs = getFileSystem("broken-document");
    await fs.write({ path: "preview/index.html", content: "<p>unfinished</p>" });
    expect((await verifyPreviewResponds("broken-document")).ok).toBe(false);
  });
});
