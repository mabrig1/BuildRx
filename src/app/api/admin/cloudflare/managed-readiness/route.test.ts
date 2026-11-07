import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/health/admin-guard", () => ({ requireAdmin: vi.fn() }));
vi.mock("@/lib/supabase/config", () => ({ isSupabaseConfigured: vi.fn() }));
vi.mock("@/lib/deploy/cloudflare-operator-readiness", () => ({
  checkCloudflareOperatorReadiness: vi.fn(),
}));

import { requireAdmin } from "@/lib/health/admin-guard";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { checkCloudflareOperatorReadiness } from "@/lib/deploy/cloudflare-operator-readiness";
import { GET } from "./route";

beforeEach(() => {
  vi.stubEnv("BUILDRX_MANAGED_OPERATOR_PREFLIGHT_ENABLED", "true");
  vi.mocked(isSupabaseConfigured).mockReturnValue(true);
  vi.mocked(requireAdmin).mockResolvedValue({ ok: true, userId: "founder" });
  vi.mocked(checkCloudflareOperatorReadiness).mockResolvedValue({
    mode: "operator_read_only", readyForManagedPublishing: false,
    status: "account_access_verified",
    blockers: ["managed_execution_unavailable", "tenant_isolation_unverified"],
    checks: { configured: true, workerScriptsRead: true,
      buildsTokensRead: true, configuredBuildTokenPresent: true,
      sourceCredentialPresent: true },
  });
});
afterEach(() => {
  vi.clearAllMocks();
  vi.unstubAllEnvs();
});

describe("admin Cloudflare readiness route", () => {
  it("remains disabled by default without invoking auth or provider checks", async () => {
    vi.stubEnv("BUILDRX_MANAGED_OPERATOR_PREFLIGHT_ENABLED", "");
    expect((await GET()).status).toBe(404);
    expect(requireAdmin).not.toHaveBeenCalled();
  });

  it("never exposes credentials in demo/no-Supabase mode", async () => {
    vi.mocked(isSupabaseConfigured).mockReturnValue(false);
    expect((await GET()).status).toBe(503);
    expect(checkCloudflareOperatorReadiness).not.toHaveBeenCalled();
  });

  it("rejects ordinary users before calling Cloudflare", async () => {
    vi.mocked(requireAdmin).mockResolvedValue({
      ok: false, response: Response.json({ error: "Forbidden" }, { status: 403 }) as never,
    });
    const response = await GET();
    expect(response.status).toBe(403);
    expect(checkCloudflareOperatorReadiness).not.toHaveBeenCalled();
  });

  it("shows admin only read-only diagnostics and never a deployable URL", async () => {
    const response = await GET();
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(body.status).toBe("account_access_verified");
    expect(body.readyForManagedPublishing).toBe(false);
    expect(body).not.toHaveProperty("url");
    expect(checkCloudflareOperatorReadiness).toHaveBeenCalledTimes(1);
  });

  it("scrubs thrown provider errors rather than leaking tokens", async () => {
    vi.mocked(checkCloudflareOperatorReadiness).mockRejectedValue(
      new Error("api-token-private")
    );
    const response = await GET();
    expect(response.status).toBe(503);
    expect(JSON.stringify(await response.json())).not.toContain("api-token-private");
  });
});
