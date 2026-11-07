/**
 * Cloudflare Workers for Platforms artifact upload adapter.
 * Only an external isolated build/attestation pipeline may supply a compiled
 * single ES module. A trusted coordinator must verify a reserved quota lease.
 *
 * NOT wired to routes/jobs; the upload capability stays off by default.
 * The adapter never builds, executes or downloads third-party source.
 * Reference: Cloudflare Workers for Platforms API examples (2026-05-05).
 */
import {
  createHash, createPublicKey, timingSafeEqual, verify as verifySignature,
} from "node:crypto";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SHA256 = /^[a-f0-9]{64}$/;
const CF_ACCOUNT = /^[a-f0-9]{32}$/i;
const NAMESPACE = /^[a-z][a-z0-9-]{0,62}$/;
const SIGNATURE = /^[A-Za-z0-9_-]{86}$/;
const MAX_ARTIFACT_BYTES = 2_000_000;
const MAX_ATTESTATION_TTL_MS = 10 * 60_000;
const MAX_CLOCK_DRIFT_MS = 30_000;
const ENGINE_VERSION = "buildrx-wfp-artifact-v1";

export interface ArtifactAttestation {
  protocol: "buildrx-wfp-artifact-v1";
  ownerId: string;
  projectId: string;
  quotaLeaseId: string;
  idempotencyKey: string;
  sourceDigest: string;
  artifactDigest: string;
  namespace: string;
  issuedAt: number;
  expiresAt: number;
}

/**
 * Lease read from durable storage by a trusted coordinator; a user-provided
 * boolean cannot replace independent storage-backed quota verification.
 */
export interface PersistedReleaseLease {
  ownerId: string;
  projectId: string;
  quotaLeaseId: string;
  idempotencyKey: string;
  sourceDigest: string;
  artifactDigest: string;
  namespace: string;
  state: "attested";
  expiresAt: number;
}

export interface WfpUploadInput {
  attestation: ArtifactAttestation;
  signature: string;
  compiledModule: string;
  verifiedLease: PersistedReleaseLease;
  publicKeyPem: string;
  accountId: string;
  apiToken: string;
  // Supplied only by a private deployment worker, never browser request JSON.
  executionEnabled: boolean;
  now?: number;
}

export class WfpAdapterError extends Error {
  constructor(code: "disabled" | "invalid_artifact" | "invalid_proof" |
    "invalid_lease" | "invalid_configuration" | "provider_unverified") {
    super("Worker deployment rejected: " + code);
    this.name = "WfpAdapterError";
  }
}

function matchUuid(input: string) {
  return typeof input === "string" && UUID.test(input);
}

/** Stable isolated script target for one project; no user-editable slugs. */
export function managedWfpScriptName(projectId: string): string {
  if (!matchUuid(projectId)) throw new WfpAdapterError("invalid_artifact");
  return "brx-" + projectId.replace(/-/g, "").toLowerCase();
}

function serializeClaim(claim: ArtifactAttestation): Buffer {
  // Canonical fixed-order array; independent of object field insertion order.
  return Buffer.from(JSON.stringify([
    ENGINE_VERSION, claim.ownerId, claim.projectId, claim.quotaLeaseId,
    claim.idempotencyKey, claim.sourceDigest, claim.artifactDigest,
    claim.namespace, claim.issuedAt, claim.expiresAt,
  ]), "utf8");
}

function same(left: string, right: string): boolean {
  if (typeof left !== "string" || typeof right !== "string") return false;
  const a = Buffer.from(left, "utf8"), b = Buffer.from(right, "utf8");
  return a.length === b.length && timingSafeEqual(a, b);
}

/** Validate compiled artifact, signed proof and durable lease offline. */
export function validateWfpArtifact(input: WfpUploadInput): {
  scriptName: string;
  namespace: string;
  digest: string;
  byteSize: number;
} {
  const { attestation: a, verifiedLease: lease, compiledModule: module,
    accountId, apiToken, signature, publicKeyPem } = input;
  if (process.env.BUILDRX_WFP_ARTIFACT_UPLOAD_ENABLED !== "true" ||
      !input.executionEnabled) throw new WfpAdapterError("disabled");
  if (!a || !lease || !matchUuid(a.ownerId) || !matchUuid(a.projectId) ||
      !matchUuid(a.quotaLeaseId) || !matchUuid(a.idempotencyKey) ||
      a.protocol !== ENGINE_VERSION || !SHA256.test(a.sourceDigest) ||
      !SHA256.test(a.artifactDigest) || !NAMESPACE.test(a.namespace)) {
    throw new WfpAdapterError("invalid_artifact");
  }
  // The deployer namespace must originate from operator settings and be
  // independently checked against a reserved tenant job before this call.
  if (!CF_ACCOUNT.test(accountId) || typeof apiToken !== "string" ||
      apiToken.length < 15 || typeof publicKeyPem !== "string" ||
      !same(process.env.BUILDRX_MANAGED_WFP_ACCOUNT_ID ?? "", accountId) ||
      !same(process.env.BUILDRX_MANAGED_WFP_NAMESPACE ?? "", a.namespace) ||
      !same(process.env.BUILDRX_MANAGED_WFP_API_TOKEN ?? "", apiToken)) {
    throw new WfpAdapterError("invalid_configuration");
  }
  if (typeof module !== "string" || !module.trim()) {
    throw new WfpAdapterError("invalid_artifact");
  }
  const bytes = Buffer.byteLength(module, "utf8");
  if (bytes > MAX_ARTIFACT_BYTES || module.includes("\0")) {
    throw new WfpAdapterError("invalid_artifact");
  }
  const digest = createHash("sha256").update(module, "utf8").digest("hex");
  if (!same(digest, a.artifactDigest)) throw new WfpAdapterError("invalid_artifact");
  const now = input.now ?? Date.now();
  if (!Number.isSafeInteger(now) || !Number.isSafeInteger(a.issuedAt) ||
      !Number.isSafeInteger(a.expiresAt) || a.issuedAt > now + MAX_CLOCK_DRIFT_MS ||
      a.expiresAt <= now || a.expiresAt - a.issuedAt > MAX_ATTESTATION_TTL_MS) {
    throw new WfpAdapterError("invalid_proof");
  }
  const fields = ["ownerId", "projectId", "quotaLeaseId", "idempotencyKey",
    "sourceDigest", "artifactDigest", "namespace"] as const;
  if (lease.state !== "attested" || !Number.isSafeInteger(lease.expiresAt) ||
      lease.expiresAt <= now || fields.some(field => !same(lease[field], a[field]))) {
    throw new WfpAdapterError("invalid_lease");
  }
  if (!SIGNATURE.test(signature)) throw new WfpAdapterError("invalid_proof");
  try {
    const key = createPublicKey(publicKeyPem);
    if (key.asymmetricKeyType !== "ed25519" ||
        !verifySignature(null, serializeClaim(a), key, Buffer.from(signature, "base64url"))) {
      throw new Error("Bad signature");
    }
  } catch {
    throw new WfpAdapterError("invalid_proof");
  }
  return {
    scriptName: managedWfpScriptName(a.projectId),
    namespace: a.namespace,
    digest,
    byteSize: bytes,
  };
}

/**
 * Uploads only a verified, already-built single-module artifact.
 * Does NOT claim a live URL, execute npm, provision namespaces, attach
 * bindings, change routing, create tokens, promote, or roll back releases.
 * Currently called by no production service.
 */
export async function uploadAttestedWfpArtifact(
  input: WfpUploadInput, http: typeof fetch = fetch
): Promise<{ uploaded: true; scriptName: string; artifactDigest: string }> {
  const validated = validateWfpArtifact(input);
  const url = "https://api.cloudflare.com/client/v4/accounts/" +
    input.accountId + "/workers/dispatch/namespaces/" +
    validated.namespace + "/scripts/" + validated.scriptName;
  const form = new FormData();
  form.append("metadata", new Blob([
    JSON.stringify({ main_module: "worker.mjs", compatibility_date: "2026-11-07", bindings: [] }),
  ], { type: "application/json" }));
  form.append("worker.mjs", new Blob([input.compiledModule], {
    type: "application/javascript+module",
  }), "worker.mjs");
  try {
    const response = await http(url, {
      method: "PUT",
      headers: { Authorization: "Bearer " + input.apiToken },
      body: form,
      redirect: "manual",
      cache: "no-store",
      signal: AbortSignal.timeout(20_000),
    });
    if (!response.ok) throw new Error("Unsuccessful provider status");
    const body: unknown = await response.json();
    if (!body || typeof body !== "object" ||
        (body as { success?: unknown }).success !== true) {
      throw new Error("Provider response was not verified");
    }
  } catch {
    // Never echo provider errors or tokens. The coordinator keeps the
    // release not-live until exact release smoke tests and rollback exist.
    throw new WfpAdapterError("provider_unverified");
  }
  return { uploaded: true, scriptName: validated.scriptName, artifactDigest: validated.digest };
}

/** Canonical byte representation signed by the trusted attestation service. */
export function serializeArtifactAttestation(a: ArtifactAttestation): Buffer {
  return serializeClaim(a);
}
