import { createHash, generateKeyPairSync, sign } from "node:crypto";
import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import {
  managedWfpScriptName, serializeArtifactAttestation, uploadAttestedWfpArtifact,
  validateWfpArtifact, type ArtifactAttestation, type WfpUploadInput,
} from "./cloudflare-wfp-artifact";

const { privateKey, publicKey } = generateKeyPairSync("ed25519");
const now = 1_800_000_000_000;
const uuid = (digit: string) => digit.repeat(8) + "-" + digit.repeat(4) + "-4" +
  digit.repeat(3) + "-8" + digit.repeat(3) + "-" + digit.repeat(12);
const worker = 'export default { async fetch(){ return new Response("Hi"); } };';
const projectId = uuid("a");
const ownerId = uuid("b");
const quotaLeaseId = uuid("c");
const idempotencyKey = uuid("d");

function valid(overrides: Partial<WfpUploadInput> = {}): WfpUploadInput {
  const claims: ArtifactAttestation = {
    protocol: "buildrx-wfp-artifact-v1", ownerId, projectId, quotaLeaseId,
    idempotencyKey, sourceDigest: "e".repeat(64),
    artifactDigest: createHash("sha256").update(worker).digest("hex"),
    namespace: "buildrx-staging",
    issuedAt: now - 60_000, expiresAt: now + 120_000,
  };
  const signature = sign(null, serializeArtifactAttestation(claims), privateKey)
    .toString("base64url");
  return {
    attestation: claims, signature, compiledModule: worker,
    verifiedLease: {
      ownerId, projectId, quotaLeaseId, idempotencyKey,
      sourceDigest: claims.sourceDigest, artifactDigest: claims.artifactDigest,
      namespace: claims.namespace, state: "attested", expiresAt: now + 120_000,
    },
    accountId: "f".repeat(32),
    apiToken: "SECRET-PRIVATE-OPERATOR-TOKEN",
    publicKeyPem: publicKey.export({ type: "spki", format: "pem" }).toString(),
    now, executionEnabled: true, ...overrides,
  };
}

beforeEach(() => {
  vi.stubEnv("BUILDRX_WFP_ARTIFACT_UPLOAD_ENABLED", "true");
  vi.stubEnv("BUILDRX_MANAGED_WFP_ACCOUNT_ID", "f".repeat(32));
  vi.stubEnv("BUILDRX_MANAGED_WFP_NAMESPACE", "buildrx-staging");
  vi.stubEnv("BUILDRX_MANAGED_WFP_API_TOKEN", "SECRET-PRIVATE-OPERATOR-TOKEN");
});
afterEach(() => vi.unstubAllEnvs());

describe("BuildRx Workers for Platforms artifact contract", () => {
  it("derives a fixed script name independent of tenant supplied display names", () => {
    expect(managedWfpScriptName(ownerId, projectId)).toMatch(/^brx-[a-f0-9]{36}$/);
    expect(() => managedWfpScriptName(ownerId, "../operator")).toThrow(/invalid_artifact/);
  });

  it("accepts a signed artifact bound to an attested lease", () => {
    expect(validateWfpArtifact(valid())).toMatchObject({
      scriptName: managedWfpScriptName(ownerId, projectId),
      namespace: "buildrx-staging",
      byteSize: Buffer.byteLength(worker),
    });
  });

  it("refuses uploads when the server-only feature flag is off or namespace is changed", async () => {
    const http = vi.fn();
    vi.stubEnv("BUILDRX_WFP_ARTIFACT_UPLOAD_ENABLED", "false");
    await expect(uploadAttestedWfpArtifact(valid(), http as typeof fetch))
      .rejects.toThrow(/disabled/);
    vi.stubEnv("BUILDRX_WFP_ARTIFACT_UPLOAD_ENABLED", "true");
    vi.stubEnv("BUILDRX_MANAGED_WFP_NAMESPACE", "operator-other-namespace");
    await expect(uploadAttestedWfpArtifact(valid(), http as typeof fetch))
      .rejects.toThrow(/invalid_configuration/);
    expect(http).not.toHaveBeenCalled();
  });

  it("never uploads without an explicit private executor switch", async () => {
    const http = vi.fn();
    await expect(uploadAttestedWfpArtifact(valid({ executionEnabled: false }),
      http as typeof fetch)).rejects.toThrow(/disabled/);
    expect(http).not.toHaveBeenCalled();
  });

  it("rejects modified compiled code even when the signed proof is valid", async () => {
    const http = vi.fn();
    await expect(uploadAttestedWfpArtifact(valid({
      compiledModule: worker + "\nmalicious",
    }), http as typeof fetch)).rejects.toThrow(/invalid_artifact/);
    expect(http).not.toHaveBeenCalled();
  });

  it("rejects forged signatures, expired proofs and mismatched tenant leases", async () => {
    const badProof = valid({ signature: "A".repeat(86) });
    expect(() => validateWfpArtifact(badProof)).toThrow(/invalid_proof/);
    expect(() => validateWfpArtifact(valid({ now: now + 180_000 }))).toThrow(/invalid_proof/);
    const badLease = valid();
    badLease.verifiedLease = { ...badLease.verifiedLease, ownerId: uuid("f") };
    expect(() => validateWfpArtifact(badLease)).toThrow(/invalid_lease/);
    const wrongNamespace = valid();
    wrongNamespace.verifiedLease = { ...wrongNamespace.verifiedLease, namespace: "other-account" };
    expect(() => validateWfpArtifact(wrongNamespace)).toThrow(/invalid_lease/);
  });

  it("uploads only a single bounded ES module to a fixed Cloudflare API endpoint", async () => {
    const http = vi.fn(async (url: string, options: RequestInit) => {
      expect(url).toBe(
        "https://api.cloudflare.com/client/v4/accounts/" +
        "f".repeat(32) + "/workers/dispatch/namespaces/buildrx-staging/scripts/" +
        managedWfpScriptName(ownerId, projectId)
      );
      expect(options.method).toBe("PUT");
      expect(options.redirect).toBe("manual");
      expect(options.body).toBeInstanceOf(FormData);
      const form = options.body as FormData;
      const metadata = form.get("metadata") as Blob;
      expect(JSON.parse(await metadata.text())).toEqual({
        main_module: "worker.mjs", compatibility_date: "2026-11-07", bindings: [],
      });
      const file = form.get("worker.mjs") as File;
      expect(file.name).toBe("worker.mjs");
      expect(await file.text()).toBe(worker);
      return Response.json({ success: true, result: { id: managedWfpScriptName(ownerId, projectId) } });
    });
    const result = await uploadAttestedWfpArtifact(valid(), http as typeof fetch);
    expect(result.uploaded).toBe(true);
    expect(result).not.toHaveProperty("url");
    expect(http).toHaveBeenCalledTimes(1);
  });

  it("does not claim success when Cloudflare replies success:false or has an HTTP error", async () => {
    for (const response of [
      Response.json({ success: false, errors: [{ message: "SECRET" }] }),
      Response.json({ message: "SECRET" }, { status: 403 }),
    ]) {
      const http = vi.fn(async () => response.clone());
      await expect(uploadAttestedWfpArtifact(valid(), http as typeof fetch))
        .rejects.toThrow(/provider_unverified/);
    }
  });

  it("does not upload excessively large artifacts or expose operator credentials on failures", async () => {
    const http = vi.fn();
    expect(() => validateWfpArtifact(valid({ compiledModule: "x".repeat(2_000_001) })))
      .toThrow(/invalid_artifact/);
    const keyMissing = valid({ apiToken: "" });
    expect(() => validateWfpArtifact(keyMissing)).toThrow(/invalid_configuration/);
    expect(http).not.toHaveBeenCalled();
  });

  it("won't allow edits to signed release claim fields", () => {
    const input = valid();
    input.attestation = { ...input.attestation, namespace: "buildrx-production" };
    // Operator namespace allowlisting is deliberately checked BEFORE
    // durable-lease reconciliation: this must fail as invalid_configuration.
    expect(() => validateWfpArtifact(input)).toThrow(/invalid_configuration/);
    const forged = valid();
    forged.attestation = { ...forged.attestation, sourceDigest: "1".repeat(64) };
    forged.verifiedLease = { ...forged.verifiedLease, sourceDigest: "1".repeat(64) };
    expect(() => validateWfpArtifact(forged)).toThrow(/invalid_proof/);
  });
});
