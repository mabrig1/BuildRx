import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/config/validate", () => ({
  announceConfigurationOnce: vi.fn(),
  validateConfiguration: vi.fn(() => ({ ok: true })),
}));

vi.mock("@/lib/ai/models", () => ({
  resolvedModelPlan: vi.fn(async () => ({ primaryCoding: "test/model" })),
  resolvedOpenRouterPlan: vi.fn(async () => ({ primaryCoding: "test/model" })),
}));

import { GET } from "@/app/api/ai/health/route";

describe("GET /api/ai/health", () => {
  beforeEach(() => {
    vi.stubEnv("OPENROUTER_API_KEY", "test-openrouter-key");
    vi.stubEnv("NVIDIA_API_KEY", "");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("is healthy when OpenRouter is configured without NVIDIA", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("{}", { status: 200 }))
    );

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toMatchObject({
      status: "healthy",
      configured: true,
      reachable: true,
      primaryProvider: "openrouter",
    });
    expect(body.providers).toEqual([
      expect.objectContaining({ name: "openrouter", reachable: true }),
    ]);
  });

  it("uses NVIDIA when it is the only configured provider", async () => {
    vi.stubEnv("OPENROUTER_API_KEY", "");
    vi.stubEnv("NVIDIA_API_KEY", "test-nvidia-key");
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("{}", { status: 200 }))
    );

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.primaryProvider).toBe("nvidia");
  });

  it("reports degraded when the primary fails but the fallback is reachable", async () => {
    vi.stubEnv("NVIDIA_API_KEY", "test-nvidia-key");
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: string | URL | Request) => {
        const url = String(input);
        return new Response("{}", {
          status: url.includes("openrouter") ? 401 : 200,
        });
      })
    );

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.status).toBe("degraded");
    expect(body.reachable).toBe(true);
    expect(body.providers).toEqual([
      expect.objectContaining({
        name: "openrouter",
        reachable: false,
        errorCategory: "auth_rejected",
      }),
      expect.objectContaining({ name: "nvidia", reachable: true }),
    ]);
  });
});
