import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "./route";
const mocks = vi.hoisted(() => ({
  session: vi.fn(), client: vi.fn(), note: vi.fn(), insert: vi.fn(), from: vi.fn(),
}));
vi.mock("@/lib/clients/admin-session", () => ({ getClientAdminSession: mocks.session }));
const id = "9aa6ce88-9e87-492c-b704-5bd89e01fb89";
const context = { params: Promise.resolve({ id }) };
const req = (body: unknown) => new Request("https://example.com/api/admin/clients/" + id + "/notes", {
  method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body),
});
beforeEach(() => {
  vi.clearAllMocks();
  mocks.client.mockResolvedValue({ data: { id }, error: null });
  mocks.note.mockResolvedValue({ data: { id: "note-123" }, error: null });
  mocks.insert.mockReturnValue({ select: () => ({ single: mocks.note }) });
  mocks.from.mockImplementation((table: string) =>
    table === "users" ? { select: () => ({ eq: () => ({ maybeSingle: mocks.client }) }) }
      : { insert: mocks.insert });
  mocks.session.mockResolvedValue({ user: { id: "admin-verified-id" }, db: { from: mocks.from } });
});
describe("private client management notes", () => {
  it("rejects any request that lacks a verified admin session", async () => {
    mocks.session.mockResolvedValueOnce(null);
    expect((await POST(req({ content: "Follow up by email" }), context)).status).toBe(403);
    expect(mocks.insert).not.toHaveBeenCalled();
  });
  it("requires a valid target client and meaningful content", async () => {
    expect((await POST(req({ content: "short" }), context)).status).toBe(400);
    mocks.client.mockResolvedValueOnce({ data: null, error: null });
    expect((await POST(req({ content: "Follow up with client privately" }), context)).status).toBe(404);
  });
  it("stores the verified administrator ID, ignoring any spoofed author", async () => {
    const response = await POST(req({ content: "Follow up on deployment error", author_id: "intruder" }), context);
    expect(response.status).toBe(201);
    expect(mocks.insert).toHaveBeenCalledWith({
      client_id: id, author_id: "admin-verified-id", content: "Follow up on deployment error",
    });
  });
});
