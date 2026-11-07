import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "./route";
import { GET as getPreview } from "@/app/api/preview/[projectId]/route";
import { getFileSystem } from "@/lib/files/manager";
import { verifyPreviewResponds } from "@/lib/agents/tools";
import type { AgentEvent } from "@/lib/agents/types";

vi.mock("@/lib/ai/route-helpers", () => ({
  authorizeAiRequest: async () => ({ ok: true, userId: null, limitHeaders: {} }),
}));
vi.mock("@/lib/supabase/config", () => ({ isSupabaseConfigured: () => false }));
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
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

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
