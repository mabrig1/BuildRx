import { beforeEach, describe, expect, it, vi } from "vitest";
import { PATCH } from "./route";
const mocks = vi.hoisted(() => ({ adminSession: vi.fn(), update: vi.fn(), one: vi.fn() }));
vi.mock("@/lib/clients/admin-session", () => ({ getClientAdminSession: mocks.adminSession }));
const id = "9aa6ce88-9e87-492c-b704-5bd89e01fb89";
const req = (body: unknown) => new Request("https://example.com/api/admin/tickets/" + id, {
  method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(body),
});
const context = { params: Promise.resolve({ id }) };
beforeEach(() => {
  vi.clearAllMocks();
  mocks.one.mockResolvedValue({ data: { id, status: "resolved", priority: "normal" }, error: null });
  mocks.update.mockReturnValue({ eq: () => ({ select: () => ({ maybeSingle: mocks.one }) }) });
  mocks.adminSession.mockResolvedValue({
    user: { id: "admin-user-id" },
    db: { from: () => ({ update: mocks.update }) },
  });
});
describe("private support ticket status API", () => {
  it("rejects callers without an authenticated admin session", async () => {
    mocks.adminSession.mockResolvedValueOnce(null);
    expect((await PATCH(req({ status: "resolved", priority: "normal" }), context)).status).toBe(403);
    expect(mocks.update).not.toHaveBeenCalled();
  });
  it("rejects arbitrary or unsafe status changes", async () => {
    expect((await PATCH(req({ status: "paid", priority: "normal" }), context)).status).toBe(400);
    expect((await PATCH(req({ status: "resolved", priority: "superadmin" }), context)).status).toBe(400);
  });
  it("records the authenticated admin user as the last status updater", async () => {
    const response = await PATCH(req({ status: "resolved", priority: "normal" }), context);
    expect(response.status).toBe(200);
    expect(mocks.update).toHaveBeenCalledWith({
      status: "resolved", priority: "normal", last_updated_by: "admin-user-id",
    });
  });
});
