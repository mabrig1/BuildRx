import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "./route";

const stubs = vi.hoisted(() => ({
  getUser: vi.fn(), lookup: vi.fn(), readSnapshot: vi.fn(), audit: vi.fn(),
}));
vi.mock("@/lib/supabase/config", () => ({ isSupabaseConfigured: () => true }));
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: { getUser: stubs.getUser },
    from: () => ({ select: () => ({
      eq: () => ({ eq: () => ({ maybeSingle: stubs.lookup }) }),
    }) }),
  }),
}));
vi.mock("@/lib/files/manager", () => ({ getFileSystem: () => ({ readSnapshot: stubs.readSnapshot }) }));
vi.mock("@/lib/agents/tools", () => ({ TOOL_LIMITS: { maxFiles: 120 } }));
vi.mock("@/lib/projects/app-doctor", () => ({ auditSavedApp: stubs.audit }));

const projectId = "9aa6ce88-9e87-492c-b704-5bd89e01fb89";
const request = () => new Request("https://www.buildrx.online/api/projects/" + projectId + "/doctor");
const context = (id = projectId) => ({ params: Promise.resolve({ projectId: id }) });

beforeEach(() => {
  vi.clearAllMocks();
  stubs.getUser.mockResolvedValue({ data: { user: { id: "owner-id" } }, error: null });
  stubs.lookup.mockResolvedValue({ data: { id: projectId, status: "ready" }, error: null });
  stubs.readSnapshot.mockResolvedValue([{ path: "package.json", content: '{"scripts":{"build":"next build"}}' }]);
  stubs.audit.mockReturnValue({ state: "review-preview", blockers: 0, findings: [] });
});

describe("private App Doctor endpoint", () => {
  it("requires a verified user session before reading source", async () => {
    stubs.getUser.mockResolvedValueOnce({ data: { user: null }, error: null });
    expect((await GET(request(), context())).status).toBe(401);
    expect(stubs.readSnapshot).not.toHaveBeenCalled();
  });
  it("rejects malformed project IDs", async () => {
    expect((await GET(request(), context("not-a-uuid"))).status).toBe(400);
    expect(stubs.getUser).not.toHaveBeenCalled();
  });
  it("enforces project ownership before touching the VFS", async () => {
    stubs.lookup.mockResolvedValueOnce({ data: null, error: null });
    expect((await GET(request(), context())).status).toBe(404);
    expect(stubs.readSnapshot).not.toHaveBeenCalled();
  });
  it("returns read-only diagnostic metadata without executing a repair", async () => {
    const response = await GET(request(), context());
    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(await response.json()).toEqual(expect.objectContaining({
      autoRepairPerformed: false, deployed: false,
    }));
    expect(stubs.readSnapshot).toHaveBeenCalledWith(120);
    expect(stubs.audit).toHaveBeenCalledWith(expect.any(Array), "ready");
  });
  it("fails closed on oversized source snapshots", async () => {
    stubs.readSnapshot.mockResolvedValueOnce([{ path: "huge.ts", content: "a".repeat(2_000_001) }]);
    expect((await GET(request(), context())).status).toBe(413);
    expect(stubs.audit).not.toHaveBeenCalled();
  });
  it("does not claim a completed scan when source retrieval fails", async () => {
    stubs.readSnapshot.mockRejectedValueOnce(new Error("Database unavailable"));
    expect((await GET(request(), context())).status).toBe(503);
    expect(stubs.audit).not.toHaveBeenCalled();
  });
});
