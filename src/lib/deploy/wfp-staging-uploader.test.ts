import { describe, expect, it, vi } from "vitest";
import {
  managedWorkerName,
  moduleDigest,
  signStagingArtifact,
  verifyStagingArtifact,
  type StagingWorkerArtifact,
} from "./wfp-staging-artifact";
import { StagingUploadError, uploadVerifiedStagingWorker } from "./wfp-staging-uploader";

const TENANT = "550e8400-e29b-41d4-a716-446655440000";
const PROJECT = "550e8400-e29b-41d4-a716-446655440001";
const OTHER = "550e8400-e29b-41d4-a716-446655440002";
const SOURCE = "d".repeat(64);
const KEY = "test-only-builder-attestation-signing-key-over-32-characters";
const MODULE = 'export default {async fetch(){return new Response("test")}}';
const NOW = new Date("2026-11-07T06:00:00.000Z");
const ENV: Record<string, string> = {
  BUILDRX_MANAGED_WFP_STAGING_UPLOAD_ENABLED: "true",
  BUILDRX_MANAGED_WFP_EXECUTOR_CONTEXT: "isolated_deploy_worker",
  BUILDRX_MANAGED_WFP_STAGING_NAMESPACE: "buildrx-staging",
  BUILDRX_MANAGED_WFP_ACCOUNT_ID: "a".repeat(32),
  BUILDRX_MANAGED_WFP_STAGING_UPLOAD_TOKEN: "test-only-never-use-this-cloudflare-token",
  BUILDRX_MANAGED_WFP_ARTIFACT_VERIFY_KEY: KEY,
  BUILDRX_MANAGED_WFP_TRUSTED_BUILDER_ID: "isolated-builder-v1",
};

function artifact(overrides: Partial<Omit<StagingWorkerArtifact, "signature">> = {}) {
  return signStagingArtifact({
    version: "buildrx-staging-module-v1", tenantId: TENANT, projectId: PROJECT,
    sourceDigest: SOURCE, moduleSha256: moduleDigest(MODULE), module: MODULE,
    builderId: "isolated-builder-v1",
    issuedAt: new Date(Date.now() - 10_000).toISOString(),
    expiresAt: new Date(Date.now() + 120_000).toISOString(),
    ...overrides,
  }, KEY);
}

describe("isolated staging Worker artifact contract", () => {
  it("allocates stable private Worker identities without tenant naming collisions", () => {
    const name = managedWorkerName(TENANT, PROJECT);
    expect(name).toMatch(/^brx-[a-f0-9]{36}$/);
    expect(name).toBe(managedWorkerName(TENANT, PROJECT));
    expect(name).not.toBe(managedWorkerName(TENANT, OTHER));
    expect(name).not.toBe(managedWorkerName(OTHER, PROJECT));
    expect(() => managedWorkerName("../../bad", PROJECT)).toThrow();
  });

  it("refuses cross-tenant replay, source changes, unknown builders and tampering", () => {
    const signed = artifact();
    const accepted = verifyStagingArtifact(signed, KEY, {
      tenantId: TENANT, projectId: PROJECT, sourceDigest: SOURCE,
      builderId: "isolated-builder-v1"
    });
    expect(accepted.moduleSha256).toBe(signed.moduleSha256);
    expect(() => verifyStagingArtifact(signed, KEY, {
      tenantId: OTHER, projectId: PROJECT, sourceDigest: SOURCE,
      builderId: "isolated-builder-v1"
    })).toThrow(/scoped/);
    expect(() => verifyStagingArtifact(signed, KEY, {
      tenantId: TENANT, projectId: PROJECT, sourceDigest: "a".repeat(64),
      builderId: "isolated-builder-v1"
    })).toThrow(/scoped/);
    expect(() => verifyStagingArtifact({ ...signed, module: signed.module + "evil" }, KEY, {
      tenantId: TENANT, projectId: PROJECT, sourceDigest: SOURCE,
      builderId: "isolated-builder-v1"
    })).toThrow(/content has changed/);
  });

  it("rejects expired signatures, future-signed artifacts and oversized modules", () => {
    const old = artifact({
      issuedAt: "2026-11-06T23:00:00Z", expiresAt: "2026-11-06T23:05:00Z"
    });
    const future = artifact({
      issuedAt: "2026-11-07T06:02:00Z", expiresAt: "2026-11-07T06:05:00Z"
    });
    const expectCtx = { tenantId: TENANT, projectId: PROJECT,
      sourceDigest: SOURCE, builderId: "isolated-builder-v1" };
    expect(() => verifyStagingArtifact(old, KEY, expectCtx, NOW)).toThrow(/stale/);
    expect(() => verifyStagingArtifact(future, KEY, expectCtx, NOW)).toThrow(/stale/);
    const large = "x".repeat(512_001);
    const oversize = artifact({ module: large, moduleSha256: moduleDigest(large) });
    expect(() => verifyStagingArtifact(oversize, KEY, expectCtx)).toThrow(/limits/);
  });

  it("denies network writes unless all isolated worker + staging toggles are explicitly enabled", async () => {
    const http = vi.fn(async () => Response.json({ success: true }));
    for (const changed of [
      { ...ENV, BUILDRX_MANAGED_WFP_STAGING_UPLOAD_ENABLED: "false" },
      { ...ENV, BUILDRX_MANAGED_WFP_EXECUTOR_CONTEXT: "web" },
      { ...ENV, BUILDRX_MANAGED_WFP_STAGING_NAMESPACE: "production" },
      { ...ENV, BUILDRX_MANAGED_WFP_ACCOUNT_ID: "bad" },
      { ...ENV, BUILDRX_MANAGED_WFP_STAGING_UPLOAD_TOKEN: "" },
      {},
    ]) {
      await expect(uploadVerifiedStagingWorker(artifact(), {
        tenantId: TENANT, projectId: PROJECT, sourceDigest: SOURCE
      }, changed, http as typeof fetch)).rejects.toThrow(StagingUploadError);
    }
    expect(http).not.toHaveBeenCalled();
  });

  it("uploads only via Cloudflare staging PUT with a signed immutable artifact", async () => {
    const http = vi.fn(async (url: string, init: RequestInit) => {
      expect(url).toBe(
        "https://api.cloudflare.com/client/v4/accounts/" + "a".repeat(32) +
        "/workers/dispatch/namespaces/buildrx-staging/scripts/" + managedWorkerName(TENANT, PROJECT)
      );
      expect(init.method).toBe("PUT");
      expect(init.body).toBeInstanceOf(FormData);
      const form = init.body as FormData;
      const metadata = form.get("metadata") as Blob;
      expect(JSON.parse(await metadata.text())).toMatchObject({
        main_module: "worker.mjs", tags: ["buildrx", "staging", "managed-v1"]
      });
      const js = form.get("worker.mjs") as File;
      expect(await js.text()).toBe(MODULE);
      expect(init.headers).toEqual({
        Authorization: "Bearer " + ENV.BUILDRX_MANAGED_WFP_STAGING_UPLOAD_TOKEN
      });
      return Response.json({ success: true, result: { id: "not-a-public-hostname" } });
    });
    const result = await uploadVerifiedStagingWorker(artifact(), {
      tenantId: TENANT, projectId: PROJECT, sourceDigest: SOURCE
    }, ENV, http as typeof fetch);
    expect(http).toHaveBeenCalledTimes(1);
    expect(result).toEqual({
      status: "uploaded_unverified", workerName: managedWorkerName(TENANT, PROJECT),
      artifactSha256: moduleDigest(MODULE), deployed: false, url: null
    });
    expect(JSON.stringify(result)).not.toContain("Bearer");
  });

  it("never sends network requests for wrong tenant/changed source or altered signatures", async () => {
    const http = vi.fn(async () => Response.json({ success: true }));
    const wrong = { tenantId: OTHER, projectId: PROJECT, sourceDigest: SOURCE };
    await expect(uploadVerifiedStagingWorker(artifact(), wrong, ENV, http as typeof fetch))
      .rejects.toThrow(StagingUploadError);
    const bad = { ...artifact(), signature: "0".repeat(64) };
    await expect(uploadVerifiedStagingWorker(bad, {
      tenantId: TENANT, projectId: PROJECT, sourceDigest: SOURCE
    }, ENV, http as typeof fetch)).rejects.toThrow(StagingUploadError);
    expect(http).not.toHaveBeenCalled();
  });

  it("sanitizes Cloudflare errors and never claims a live URL even on HTTP success", async () => {
    for (const fetcher of [
      async () => Response.json({ success: false, errors: ["SECRET_TOKEN"] }),
      async () => Response.json({ success: true }, { status: 403 }),
      async () => { throw new Error("SECRET_TOKEN"); },
    ]) {
      const http = vi.fn(fetcher);
      try {
        await uploadVerifiedStagingWorker(artifact(), {
          tenantId: TENANT, projectId: PROJECT, sourceDigest: SOURCE
        }, ENV, http as typeof fetch);
        throw new Error("Unexpected success");
      } catch (error) {
        expect(error).toBeInstanceOf(StagingUploadError);
        expect(String(error)).not.toContain("SECRET_TOKEN");
      }
    }
  });
});
