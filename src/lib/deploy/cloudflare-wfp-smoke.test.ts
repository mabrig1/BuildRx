import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { managedWfpScriptName } from "./cloudflare-wfp-artifact";
import { probeWfpWorker } from "./cloudflare-wfp-smoke";

const ownerId = "550e8400-e29b-41d4-a716-446655440001";
const projectId = "550e8400-e29b-41d4-a716-446655440000";
const artifactDigest = "e".repeat(64);
const input = {
  ownerId, projectId, expectedArtifactDigest: artifactDigest,
  operatorDispatchHostname: "apps.buildrx.example",
  verifiedHostname: "tenant-app.apps.buildrx.example",
};

beforeEach(() => vi.stubEnv("BUILDRX_WFP_DISPATCH_HOST", "apps.buildrx.example"));
afterEach(() => vi.unstubAllEnvs());

describe("WfP exact-host release smoke test", () => {
  it("refuses unverified hostnames and malformed IDs without network access", async () => {
    const http = vi.fn();
    for (const overrides of [
      { verifiedHostname: "attacker.example" },
      { operatorDispatchHostname: "localhost", verifiedHostname: "tenant.localhost" },
      { operatorDispatchHostname: "127.0.0.1", verifiedHostname: "tenant.127.0.0.1" },
      { operatorDispatchHostname: "apps.buildrx.example:8443" },
      { verifiedHostname: "nested.tenant-app.apps.buildrx.example" },
      { verifiedHostname: "apps.buildrx.example" },
      { expectedArtifactDigest: "invalid" },
      { projectId: "../../../internal" },
    ]) {
      expect((await probeWfpWorker({ ...input, ...overrides }, http as typeof fetch)).passed).toBe(false);
    }
    expect(http).not.toHaveBeenCalled();
  });

  it("never probes when the exact operator hostname is unconfigured", async () => {
    const http = vi.fn();
    vi.stubEnv("BUILDRX_WFP_DISPATCH_HOST", "");
    const result = await probeWfpWorker(input, http as typeof fetch);
    expect(result.passed).toBe(false);
    expect(http).not.toHaveBeenCalled();
  });

  it("requires nonce, artifact digest and tenant worker identity echoes", async () => {
    const expectedWorker = managedWfpScriptName(ownerId, projectId);
    const http = vi.fn(async (url: string, init: RequestInit) => {
      expect(url).toBe("https://tenant-app.apps.buildrx.example/__buildrx/health");
      expect(init.method).toBe("GET");
      expect(init.redirect).toBe("manual");
      const nonce = new Headers(init.headers).get("X-BuildRx-Probe-Nonce");
      expect(nonce).toMatch(/^[A-Za-z0-9_-]{22}$/);
      return new Response("ready", {
        status: 200,
        headers: {
          "x-buildrx-probe-nonce": nonce!,
          "x-buildrx-artifact-sha256": artifactDigest,
          "x-buildrx-worker-id": expectedWorker,
        },
      });
    });
    const result = await probeWfpWorker(input, http as typeof fetch);
    expect(result).toMatchObject({
      passed: true, checks: {
        https: true, nonceEcho: true, artifactDigestEcho: true,
        workerIdentityEcho: true,
      },
    });
    expect(result).not.toHaveProperty("url");
    expect(http).toHaveBeenCalledTimes(1);
  });

  it("does not mistake stale or cross-tenant health responses for proof", async () => {
    const http = vi.fn(async () => new Response("ok", { status: 200, headers: {
      "x-buildrx-probe-nonce": "old-nonce",
      "x-buildrx-artifact-sha256": artifactDigest,
      "x-buildrx-worker-id": managedWfpScriptName(ownerId, projectId),
    } }));
    const result = await probeWfpWorker(input, http as typeof fetch);
    expect(result.passed).toBe(false);
    expect(result.checks.nonceEcho).toBe(false);
  });

  it("blocks redirects, missing headers and provider errors without exposing details", async () => {
    for (const handler of [
      async () => Response.redirect("https://other.example/login", 302),
      async () => Response.json({ healthy: true }),
      async () => { throw new Error("private token"); },
    ]) {
      const http = vi.fn(handler);
      const result = await probeWfpWorker(input, http as typeof fetch);
      expect(result.passed).toBe(false);
      expect(JSON.stringify(result)).not.toContain("private token");
    }
  });
});
