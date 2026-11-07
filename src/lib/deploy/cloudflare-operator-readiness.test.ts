import { describe, expect, it, vi } from "vitest";
import { checkCloudflareOperatorReadiness } from "./cloudflare-operator-readiness";

const env = {
  BUILDRX_MANAGED_CF_ACCOUNT_ID: "a".repeat(32),
  BUILDRX_MANAGED_CF_BUILDS_TOKEN: "private-token-DONT-SHOW",
  BUILDRX_MANAGED_CF_BUILD_TOKEN_UUID: "550e8400-e29b-41d4-a716-446655440000",
  BUILDRX_MANAGED_SOURCE_TOKEN: "source-token-DONT-SHOW",
};

describe("Cloudflare managed operator read-only readiness", () => {
  it("never touches network when disabled or missing configuration", async () => {
    const http = vi.fn();
    const result = await checkCloudflareOperatorReadiness({}, http as typeof fetch);
    expect(result.status).toBe("missing_configuration");
    expect(result.readyForManagedPublishing).toBe(false);
    expect(result.blockers).toContain("operator_configuration_missing");
    expect(http).not.toHaveBeenCalled();
  });

  it("rejects invalid account/path identifiers without a network call", async () => {
    const http = vi.fn();
    const result = await checkCloudflareOperatorReadiness({
      ...env, BUILDRX_MANAGED_CF_ACCOUNT_ID: "../passwords",
    }, http as typeof fetch);
    expect(result.status).toBe("invalid_configuration");
    expect(http).not.toHaveBeenCalled();
  });

  it("verifies two documented GET endpoints without enabling deployment", async () => {
    const http = vi.fn(async (url: string, opts: RequestInit) => {
      expect(url).toMatch(/^https:\/\/api\.cloudflare\.com\/client\/v4\/accounts\/[a-f0-9]{32}\//);
      expect(opts.method).toBe("GET");
      expect(opts.body).toBeUndefined();
      if (url.endsWith("/workers/scripts"))
        return Response.json({ success: true, result: [{ id: "existing-worker" }] });
      if (url.endsWith("/builds/tokens"))
        return Response.json({
          success: true,
          result: [{ build_token_uuid: env.BUILDRX_MANAGED_CF_BUILD_TOKEN_UUID }],
        });
      throw new Error("Unexpected external endpoint");
    });
    const result = await checkCloudflareOperatorReadiness(env, http as typeof fetch);
    expect(http).toHaveBeenCalledTimes(2);
    expect(result.checks).toMatchObject({
      configured: true, workerScriptsRead: true,
      buildsTokensRead: true, configuredBuildTokenPresent: true,
    });
    expect(result.status).toBe("account_access_verified");
    expect(result.readyForManagedPublishing).toBe(false);
    expect(result.blockers).toContain("tenant_isolation_unverified");
    expect(JSON.stringify(result)).not.toContain("DONT-SHOW");
    expect(JSON.stringify(result)).not.toContain(env.BUILDRX_MANAGED_CF_ACCOUNT_ID);
    expect(JSON.stringify(result)).not.toContain(env.BUILDRX_MANAGED_CF_BUILD_TOKEN_UUID);
  });

  it("fails closed on denied tokens, upstream errors or unexpected payload shapes", async () => {
    for (const payload of [
      () => Response.json({ errors: [{ message: env.BUILDRX_MANAGED_CF_BUILDS_TOKEN }] }, { status: 403 }),
      () => Response.json({ success: false, result: [] }),
      () => Response.json({ success: true, result: {} }),
    ]) {
      const http = vi.fn(async () => payload());
      const result = await checkCloudflareOperatorReadiness(env, http as typeof fetch);
      expect(result.status).toBe("authorization_unverified");
      expect(result.readyForManagedPublishing).toBe(false);
      expect(JSON.stringify(result)).not.toContain("private-token");
    }
  });

  it("does not confuse a list of other build tokens with the configured token", async () => {
    const http = vi.fn(async (url: string) => Response.json({
      success: true,
      result: url.endsWith("/workers/scripts") ? [] :
        [{ build_token_uuid: "11111111-1111-4111-8111-111111111111" }],
    }));
    const result = await checkCloudflareOperatorReadiness(env, http as typeof fetch);
    expect(result.status).toBe("authorization_unverified");
    expect(result.checks.configuredBuildTokenPresent).toBe(false);
  });
});
