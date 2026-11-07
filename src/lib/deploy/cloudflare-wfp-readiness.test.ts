import { describe, expect, it, vi } from "vitest";
import { readWfpNamespaceReadiness } from "./cloudflare-wfp-readiness";

const env = {
  BUILDRX_MANAGED_WFP_ACCOUNT_ID: "a".repeat(32),
  BUILDRX_MANAGED_WFP_API_TOKEN: "PRIVATE-CF-WFP-READ-TOKEN",
  BUILDRX_MANAGED_WFP_NAMESPACE: "buildrx-staging",
};

describe("WfP namespace readiness", () => {
  it("fails closed without configuration and makes no requests", async () => {
    const fetchMock = vi.fn();
    const result = await readWfpNamespaceReadiness({}, fetchMock as typeof fetch);
    expect(result.canPublish).toBe(false);
    expect(result.status).toBe("missing_configuration");
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it("rejects malformed account or namespace without making requests", async () => {
    const fetchMock = vi.fn();
    const result = await readWfpNamespaceReadiness({
      ...env, BUILDRX_MANAGED_WFP_NAMESPACE: "../../worker",
    }, fetchMock as typeof fetch);
    expect(result.status).toBe("invalid_configuration");
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it("checks an exact existing namespace with GET only and never enables publishing", async () => {
    const fetchMock = vi.fn(async (url: string, options: RequestInit) => {
      expect(url).toBe(
        "https://api.cloudflare.com/client/v4/accounts/" +
        "a".repeat(32) + "/workers/dispatch/namespaces/buildrx-staging"
      );
      expect(options.method).toBe("GET");
      expect(options.body).toBeUndefined();
      return Response.json({ success: true, result: { namespace: "buildrx-staging" } });
    });
    const result = await readWfpNamespaceReadiness(env, fetchMock as typeof fetch);
    expect(result.checks.namespaceRead).toBe(true);
    expect(result.status).toBe("namespace_read_verified");
    expect(result.canPublish).toBe(false);
    expect(result.blockers).toContain("isolated_builder_unavailable");
    expect(JSON.stringify(result)).not.toContain("PRIVATE-CF");
    expect(JSON.stringify(result)).not.toContain(env.BUILDRX_MANAGED_WFP_ACCOUNT_ID);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
  it("blocks on failed status, malformed JSON or upstream network errors", async () => {
    for (const implementation of [
      async () => Response.json({ success: false, result: {} }, { status: 403 }),
      async () => Response.json({ success: false, result: {} }),
      async () => Response.json({ success: true, result: null }),
      async () => { throw new Error("network token leakage attempt"); },
    ]) {
      const mock = vi.fn(implementation);
      const result = await readWfpNamespaceReadiness(env, mock as typeof fetch);
      expect(result.status).toBe("namespace_unverified");
      expect(result.canPublish).toBe(false);
      expect(JSON.stringify(result)).not.toContain("token leakage attempt");
    }
  });
});
