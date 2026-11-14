import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "./route";

const mocks = vi.hoisted(() => ({
  getUser: vi.fn(),
  limitCheck: vi.fn(),
  insertResult: vi.fn(),
  from: vi.fn(),
  ticketInsert: vi.fn(),
}));
vi.mock("@/lib/supabase/config", () => ({ isSupabaseConfigured: () => true }));
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ auth: { getUser: mocks.getUser }, from: mocks.from }),
}));
const userId = "9aa6ce88-9e87-492c-b704-5bd89e01fb89";
const sample = {
  category: "paid-course",
  message: "I paid for the Academy, but my enrollment is still locked.",
  reference: "demo-transaction-123",
};
const request = (body: unknown) => new Request("https://example.com/api/support/tickets", {
  method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body),
});

beforeEach(() => {
  vi.resetAllMocks();
  mocks.getUser.mockResolvedValue({ data: { user: { id: userId } }, error: null });
  mocks.limitCheck.mockResolvedValue({ count: 0, error: null });
  mocks.insertResult.mockResolvedValue({ data: { id: "ticket-uuid", status: "open" }, error: null });
  mocks.from.mockReturnValue({
    select: () => ({ eq: () => ({ gte: mocks.limitCheck }) }),
    insert: mocks.ticketInsert.mockReturnValue({ select: () => ({ single: mocks.insertResult }) }),
  });
});

describe("authenticated support ticket creation", () => {
  it("rejects anonymous users before accessing ticket storage", async () => {
    mocks.getUser.mockResolvedValueOnce({ data: { user: null }, error: null });
    const response = await POST(request(sample));
    expect(response.status).toBe(401);
    expect(mocks.from).not.toHaveBeenCalled();
  });
  it("rejects invalid categories and insufficient details", async () => {
    expect((await POST(request({ ...sample, category: "fake" }))).status).toBe(400);
    expect((await POST(request({ ...sample, message: "short" }))).status).toBe(400);
    expect(mocks.from).not.toHaveBeenCalled();
  });
  it("enforces the daily ticket cap", async () => {
    mocks.limitCheck.mockResolvedValueOnce({ count: 5, error: null });
    const response = await POST(request(sample));
    expect(response.status).toBe(429);
    expect(mocks.ticketInsert).not.toHaveBeenCalled();
  });
  it("writes a private ticket attached to verified session ID, not user-supplied identity", async () => {
    const response = await POST(request({ ...sample, user_id: "spoofed", email: "somebody@example.com" }));
    expect(response.status).toBe(201);
    expect(mocks.ticketInsert).toHaveBeenCalledWith(expect.objectContaining({
      user_id: userId, category: "paid-course",
    }));
    const inserted = mocks.ticketInsert.mock.calls[0][0];
    expect(inserted).not.toHaveProperty("email");
    expect(inserted).not.toHaveProperty("user_id", "spoofed");
    expect(inserted).not.toHaveProperty("priority");
  });
  it("fails closed when rate limit cannot be checked", async () => {
    mocks.limitCheck.mockResolvedValueOnce({ count: null, error: { message: "DB unavailable" } });
    expect((await POST(request(sample))).status).toBe(503);
    expect(mocks.ticketInsert).not.toHaveBeenCalled();
  });
});
