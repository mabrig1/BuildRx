import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { Buffer } from "node:buffer";

/**
 * Untrusted code can NEVER be built on the BuildRx Next.js request server.
 * This contract is consumed only by a future isolated, trusted deploy worker.
 *
 * No network, source parsing or cloud operations occur in this file.
 */
export interface StagingWorkerArtifact {
  version: "buildrx-staging-module-v1";
  tenantId: string;
  projectId: string;
  sourceDigest: string;
  moduleSha256: string;
  module: string;
  builderId: string;
  issuedAt: string;
  expiresAt: string;
  signature: string;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SHA256 = /^[a-f0-9]{64}$/;
const MAX_MODULE_BYTES = 512_000;
const MAX_TTL_MS = 10 * 60 * 1000;
const CLOCK_SKEW_MS = 30 * 1000;

export function managedWorkerName(tenantId: string, projectId: string): string {
  if (!UUID.test(tenantId) || !UUID.test(projectId)) {
    throw new Error("Invalid managed Worker tenant or project identity.");
  }
  // Prevent collisions and tenant-selected or cross-account Worker names.
  // Stable across multiple versions of the same app.
  return "brx-" + createHash("sha256")
    .update("buildrx-wfp-tenant-project-v1\0" + tenantId.toLowerCase() + "\0" + projectId.toLowerCase())
    .digest("hex").slice(0, 36);
}

export function moduleDigest(module: string): string {
  return createHash("sha256").update(module, "utf8").digest("hex");
}

function attestationPayload(
  value: Omit<StagingWorkerArtifact, "module" | "signature">
): string {
  return JSON.stringify([
    "buildrx-staging-module-signature-v1",
    value.version, value.tenantId.toLowerCase(), value.projectId.toLowerCase(),
    value.sourceDigest, value.moduleSha256, value.builderId, value.issuedAt, value.expiresAt
  ]);
}

/**
 * The signing key belongs ONLY in a standalone isolated builder / deployer.
 * Keep it out of browser bundles, GitHub source repositories and tenant Worker
 * bindings. Signed source must be tied to immutable build evidence separately.
 */
export function signStagingArtifact(
  data: Omit<StagingWorkerArtifact, "signature">,
  signingKey: string
): StagingWorkerArtifact {
  if (signingKey.length < 32) throw new Error("Weak builder attestation key.");
  const { module: _module, ...payload } = data;
  // Verifying the module's SHA prevents signing a mismatched payload.
  if (moduleDigest(data.module) !== data.moduleSha256) {
    throw new Error("Module digest mismatch.");
  }
  return {
    ...data,
    signature: createHmac("sha256", signingKey).update(attestationPayload(payload)).digest("hex")
  };
}

export function verifyStagingArtifact(
  artifact: StagingWorkerArtifact,
  signingKey: string,
  expected: { tenantId: string; projectId: string; sourceDigest: string; builderId: string },
  now = new Date()
): { workerName: string; moduleSha256: string } {
  if (!artifact || artifact.version !== "buildrx-staging-module-v1" ||
      typeof artifact.module !== "string" || !UUID.test(artifact.tenantId) ||
      !UUID.test(artifact.projectId) || !SHA256.test(artifact.sourceDigest) ||
      !SHA256.test(artifact.moduleSha256) || !SHA256.test(artifact.signature) ||
      typeof artifact.builderId !== "string" || artifact.builderId.length < 3 ||
      artifact.builderId.length > 64 || !/^[a-zA-Z0-9_-]+$/.test(artifact.builderId) ||
      signingKey.length < 32) {
    throw new Error("Staging artifact was not attested.");
  }
  if (artifact.tenantId.toLowerCase() !== expected.tenantId.toLowerCase() ||
      artifact.projectId.toLowerCase() !== expected.projectId.toLowerCase() ||
      artifact.sourceDigest !== expected.sourceDigest ||
      artifact.builderId !== expected.builderId) {
    throw new Error("Attestation was not scoped to the expected tenant, project, source and builder.");
  }
  const issued = Date.parse(artifact.issuedAt);
  const expires = Date.parse(artifact.expiresAt);
  if (!Number.isFinite(issued) || !Number.isFinite(expires) ||
      expires <= issued || expires - issued > MAX_TTL_MS ||
      issued > now.getTime() + CLOCK_SKEW_MS || expires <= now.getTime()) {
    throw new Error("Artifact attestation is stale or invalid.");
  }
  if (Buffer.byteLength(artifact.module, "utf8") > MAX_MODULE_BYTES ||
      moduleDigest(artifact.module) !== artifact.moduleSha256) {
    throw new Error("Artifact exceeds limits or its content has changed.");
  }
  const { module: _module, signature, ...payload } = artifact;
  const expectedMac = createHmac("sha256", signingKey)
    .update(attestationPayload(payload)).digest();
  const receivedMac = Buffer.from(signature, "hex");
  if (receivedMac.byteLength !== expectedMac.byteLength ||
      !timingSafeEqual(receivedMac, expectedMac)) {
    throw new Error("Invalid artifact signature.");
  }
  return {
    workerName: managedWorkerName(artifact.tenantId, artifact.projectId),
    moduleSha256: artifact.moduleSha256
  };
}
