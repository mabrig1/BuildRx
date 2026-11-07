import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/github/service", () => ({ getSession: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));

import { getSession } from "@/lib/github/service";
import { createClient } from "@/lib/supabase/server";
import { GET } from "./route";

const projectId = "550e8400-e29b-41d4-a716-446655440000";
const request = () => new Request("https://buildrx.example/api/deploy/managed/preflight?projectId=" + projectId);
const files = [
  { path: "package.json", content: '{"dependencies":{"next":"15.5.20"}}' },
  { path: "app/page.tsx", content: "page" },
  { path: "app/layout.tsx", content: "layout" },
];
function mockDb(project: unknown = { status: "ready" }, error: unknown = null,
  source: unknown = files, sourceError: unknown = null) {
  const projects = {
    select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue({ data: project, error }),
  };
  const sources = {
    select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue({ data: source, error: sourceError }),
  };
  // There are intentionally no insert/update/delete methods.
  const from = vi.fn((table: string) => {
    if (table === "projects") return projects;
    if (table === "project_files") return sources;
    throw new Error("Unexpected table");
  });
  vi.mocked(createClient).mockResolvedValue({ from } as unknown as Awaited<ReturnType<typeof createClient>>);
  return { from, projects, sources };
}

beforeEach(() => {
  vi.resetAllMocks();
  vi.stubEnv("BUILDRX_MANAGED_PREFLIGHT_ENABLED", "true");
  vi.mocked(getSession).mockResolvedValue({ userId: "owner-a", demo: false });
  vi.stubGlobal("fetch", vi.fn(() => { throw new Error("External calls prohibited"); }));
});
afterEach(() => {
  expect(fetch).not.toHaveBeenCalled();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("managed preflight read-only route", () => {
  it("is disabled by default before any dependency access", async () => {
    vi.stubEnv("BUILDRX_MANAGED_PREFLIGHT_ENABLED", "");
    expect((await GET(request())).status).toBe(404);
    expect(getSession).not.toHaveBeenCalled();
    expect(createClient).not.toHaveBeenCalled();
  });
  it.each([null, { userId: null, demo: true }])("rejects unauthenticated/demo users", async (session) => {
    vi.mocked(getSession).mockResolvedValue(session);
    expect((await GET(request())).status).toBe(401);
    expect(createClient).not.toHaveBeenCalled();
  });
  it("rejects malformed IDs before database access", async () => {
    expect((await GET(new Request("https://buildrx.example/?projectId=bad"))).status).toBe(400);
    expect(createClient).not.toHaveBeenCalled();
  });
  it("requires exact owner and does not read source for an inaccessible project", async () => {
    const db = mockDb(null);
    expect((await GET(request())).status).toBe(404);
    expect(db.projects.eq).toHaveBeenCalledWith("owner_id", "owner-a");
    expect(db.projects.eq).toHaveBeenCalledWith("id", projectId);
    expect(db.from).toHaveBeenCalledTimes(1);
  });
  it("fails closed on ownership lookup errors", async () => {
    const db = mockDb(null, { message: "private detail" });
    const response = await GET(request());
    expect(response.status).toBe(503);
    expect(JSON.stringify(await response.json())).not.toContain("private detail");
    expect(db.from).toHaveBeenCalledTimes(1);
  });
  it("fails closed on incomplete source reads or overflow", async () => {
    for (const [rows, error] of [[null, { message: "secret" }], [Array(501).fill(files[0]), null]]) {
      mockDb({ status: "ready" }, null, rows, error);
      expect((await GET(request())).status).toBe(503);
    }
  });
  it("does not accept client verification and returns only blocked diagnostics", async () => {
    const db = mockDb();
    const response = await GET(new Request(request().url + "&verified=true&canPublish=true"));
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(body).toMatchObject({ mode: "preflight_only", canPublish: false, deployed: false });
    expect(body.blockers).toContain("source_verification_missing");
    expect(body.blockers).toContain("managed_execution_unavailable");
    expect(body).not.toHaveProperty("url");
    expect(body).not.toHaveProperty("files");
    expect(db.sources.limit).toHaveBeenCalledWith(501);
    expect(db.sources.eq).toHaveBeenCalledWith("project_id", projectId);
  });
  it("sanitizes unexpected authentication errors", async () => {
    vi.mocked(getSession).mockRejectedValue(new Error("secret-token"));
    const response = await GET(request());
    expect(response.status).toBe(503);
    expect(JSON.stringify(await response.json())).not.toContain("secret-token");
  });
});
