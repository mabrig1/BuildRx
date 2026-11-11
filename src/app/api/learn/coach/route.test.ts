import { beforeEach, describe, expect, it, vi } from "vitest";

const { authorizeAiRequest, completeText, isAnyProviderConfigured, isSupabaseConfigured, recordAiUsage } = vi.hoisted(() => ({
  authorizeAiRequest: vi.fn(),
  completeText: vi.fn(),
  isAnyProviderConfigured: vi.fn(),
  isSupabaseConfigured: vi.fn(),
  recordAiUsage: vi.fn(),
}));

vi.mock("@/lib/ai/route-helpers", () => ({ authorizeAiRequest }));
vi.mock("@/lib/ai/provider", () => ({ completeText, isAnyProviderConfigured }));
vi.mock("@/lib/ai/usage", () => ({ recordAiUsage }));
vi.mock("@/lib/supabase/config", () => ({ isSupabaseConfigured }));

import { POST } from "./route";

function send(body: unknown) {
  return POST(new Request("https://buildrx.test/api/learn/coach", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }));
}

describe("AI tutor security and provider behavior", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    isSupabaseConfigured.mockReturnValue(true);
    isAnyProviderConfigured.mockReturnValue(true);
    authorizeAiRequest.mockResolvedValue({
      ok: true, userId: "signed-in-user", limitHeaders: { "X-RateLimit-Limit": "20" },
    });
    completeText.mockResolvedValue({
      provider: "openrouter-fast", model: "test-model",
      text: "## Test lesson\nCheck a real data write before launch.",
      usage: { promptTokens: 100, completionTokens: 90 },
    });
    recordAiUsage.mockResolvedValue(undefined);
  });

  it("does not let demo sessions invoke the paid provider", async () => {
    isSupabaseConfigured.mockReturnValue(false);
    const response = await send({ lessonId: "first-app" });
    expect(response.status).toBe(503);
    expect(completeText).not.toHaveBeenCalled();
  });

  it("requires authenticated and quota-authorized requests", async () => {
    authorizeAiRequest.mockResolvedValueOnce({
      ok: false, response: new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 }),
    });
    const response = await send({ lessonId: "first-app" });
    expect(response.status).toBe(401);
    expect(completeText).not.toHaveBeenCalled();
  });

  it("rejects secret-bearing and unknown topics before calling a model", async () => {
    expect((await send({ lessonId: "unknown-topic" })).status).toBe(400);
    expect((await send({
      lessonId: "mongodb-basics",
      goal: "mongodb+srv://user:pass@cluster.example",
    })).status).toBe(400);
    expect(completeText).not.toHaveBeenCalled();
  });

  it("refuses to fabricate AI output if no provider is configured", async () => {
    isAnyProviderConfigured.mockReturnValue(false);
    const response = await send({ lessonId: "vercel-launch" });
    expect(response.status).toBe(503);
    expect(completeText).not.toHaveBeenCalled();
  });

  it("generates only teaching text and records a metered request", async () => {
    const response = await send({
      lessonId: "cloudflare-launch", level: "first-time",
      mode: "five-day-plan", goal: "Teach me to deploy a school booking app",
    });
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.generated).toBe(true);
    expect(body.verified).toBe(false);
    expect(body.provider).toBe("openrouter-fast");
    expect(body.text).toContain("Test lesson");
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(completeText).toHaveBeenCalledOnce();
    expect(recordAiUsage).toHaveBeenCalledWith(expect.objectContaining({
      userId: "signed-in-user", status: "completed", action: "ai_generation",
    }));
  });

  it("returns an honest error when providers fail, without leaking tokens", async () => {
    completeText.mockRejectedValue(new Error("upstream error: secret-key-should-not-leak"));
    const response = await send({ lessonId: "github-basics" });
    expect(response.status).toBe(502);
    const body = await response.json();
    expect(JSON.stringify(body)).not.toContain("secret-key-should-not-leak");
    expect(recordAiUsage).toHaveBeenCalledWith(expect.objectContaining({ status: "failed" }));
  });
});
