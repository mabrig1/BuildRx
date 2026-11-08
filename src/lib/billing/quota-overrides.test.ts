import { beforeEach, describe, expect, it, vi } from "vitest";

const maybeSingle = vi.fn();
const eq = vi.fn(() => ({ maybeSingle }));
const select = vi.fn(() => ({ eq }));
const from = vi.fn(() => ({ select }));
const createClient = vi.fn(async () => ({ from }));
const isSupabaseConfigured = vi.fn(() => true);

vi.mock("@/lib/supabase/config", () => ({ isSupabaseConfigured }));
vi.mock("@/lib/supabase/server", () => ({ createClient }));

import { getAccountQuotaOverrides } from "./quota-overrides";

describe("getAccountQuotaOverrides", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    isSupabaseConfigured.mockReturnValue(true);
  });

  it("returns both explicit flags for the scoped account", async () => {
    maybeSingle.mockResolvedValue({
      data: { unlimited_projects: true, unlimited_ai_requests: true },
      error: null,
    });
    expect(await getAccountQuotaOverrides("owner-id")).toEqual({
      unlimitedProjects: true,
      unlimitedAiRequests: true,
    });
    expect(from).toHaveBeenCalledWith("account_quota_overrides");
    expect(eq).toHaveBeenCalledWith("user_id", "owner-id");
  });

  it("does not grant a partial entitlement beyond its own flag", async () => {
    maybeSingle.mockResolvedValue({
      data: { unlimited_projects: true, unlimited_ai_requests: false },
      error: null,
    });
    expect(await getAccountQuotaOverrides("owner-id")).toEqual({
      unlimitedProjects: true,
      unlimitedAiRequests: false,
    });
  });

  it("fails closed on missing rows, query errors, and exceptions", async () => {
    maybeSingle.mockResolvedValueOnce({ data: null, error: null });
    expect(await getAccountQuotaOverrides("missing")).toEqual({
      unlimitedProjects: false,
      unlimitedAiRequests: false,
    });
    maybeSingle.mockResolvedValueOnce({ data: null, error: { message: "denied" } });
    expect(await getAccountQuotaOverrides("denied")).toEqual({
      unlimitedProjects: false,
      unlimitedAiRequests: false,
    });
    createClient.mockRejectedValueOnce(new Error("unavailable"));
    expect(await getAccountQuotaOverrides("error")).toEqual({
      unlimitedProjects: false,
      unlimitedAiRequests: false,
    });
  });

  it("does not read entitlements when Supabase is not configured", async () => {
    isSupabaseConfigured.mockReturnValue(false);
    expect(await getAccountQuotaOverrides("demo")).toEqual({
      unlimitedProjects: false,
      unlimitedAiRequests: false,
    });
    expect(createClient).not.toHaveBeenCalled();
  });
});
