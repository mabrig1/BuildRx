import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextResponse } from "next/server";

vi.mock("@/lib/health/admin-guard", () => ({ requireAdmin: vi.fn() }));
vi.mock("@/lib/supabase/config", () => ({ isSupabaseConfigured: vi.fn() }));
vi.mock("@/lib/deploy/cloudflare-wfp-readiness", () => ({ readWfpNamespaceReadiness: vi.fn() }));

import { requireAdmin } from "@/lib/health/admin-guard";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { readWfpNamespaceReadiness } from "@/lib/deploy/cloudflare-wfp-readiness";
import { GET } from "./route";

beforeEach(() => {
  vi.stubEnv("BUILDRX_WFP_OPERATOR_READINESS_ENABLED", "true");
  vi.mocked(isSupabaseConfigured).mockReturnValue(true);
  vi.mocked(requireAdmin).mockResolvedValue({ ok: true, userId: "operator" });
  vi.mocked(readWfpNamespaceReadiness).mockResolvedValue({
    strategy: "workers_for_platforms", mode: "read_only", canPublish: false,
    status: "namespace_read_verified", checks: { configured: true, namespaceRead: true },
    blockers: ["isolated_builder_unavailable"],
  });
});
afterEach(() => { vi.clearAllMocks(); vi.unstubAllEnvs(); });

describe("admin WfP readiness route", () => {
  it("does not call provider checker when feature is disabled", async () => {
    vi.stubEnv("BUILDRX_WFP_OPERATOR_READINESS_ENABLED", "");
    expect((await GET()).status).toBe(404);
    expect(readWfpNamespaceReadiness).not.toHaveBeenCalled();
  });
  it("rejects demo installations without Supabase authorization", async () => {
    vi.mocked(isSupabaseConfigured).mockReturnValue(false);
    expect((await GET()).status).toBe(503);
    expect(requireAdmin).not.toHaveBeenCalled();
    expect(readWfpNamespaceReadiness).not.toHaveBeenCalled();
  });
  it("blocks non-admins before Cloudflare access", async () => {
    vi.mocked(requireAdmin).mockResolvedValue({
      ok: false, response: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    });
    expect((await GET()).status).toBe(403);
    expect(readWfpNamespaceReadiness).not.toHaveBeenCalled();
  });
  it("returns no credentials, no production URLs and permanently denies publishing", async () => {
    const result = await GET();
    expect(result.status).toBe(200);
    expect(result.headers.get("cache-control")).toBe("no-store");
    const body = await result.json();
    expect(body.canPublish).toBe(false);
    expect(body).not.toHaveProperty("url");
    expect(readWfpNamespaceReadiness).toHaveBeenCalledTimes(1);
  });
  it("sanitizes errors", async () => {
    vi.mocked(readWfpNamespaceReadiness).mockRejectedValue(new Error("SECRET-DO-NOT-LOG"));
    const result = await GET();
    expect(result.status).toBe(503);
    expect(JSON.stringify(await result.json())).not.toContain("SECRET");
  });
});
