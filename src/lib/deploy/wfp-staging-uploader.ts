import {
  managedWorkerName,
  verifyStagingArtifact,
  type StagingWorkerArtifact,
} from "./wfp-staging-artifact";

/**
 * A narrowly scoped staging-only Workers for Platforms deployment adapter.
 *
 * Important:
 * - No public route invokes this adapter.
 * - No untrusted app source is compiled, imported or executed here.
 * - It accepts ONLY a bounded, signed module emitted by a future
 *   isolated builder, checked against the current release source digest.
 * - There is intentionally no production namespace support or live URL.
 */
export interface StagingUploadResult {
  status: "uploaded_unverified";
  workerName: string;
  artifactSha256: string;
  deployed: false;
  url: null;
}
type Env = Record<string, string | undefined>;
const ACCOUNT = /^[a-f0-9]{32}$/i;
const NAMESPACE = "buildrx-staging";

export class StagingUploadError extends Error {
  constructor() {
    super("Staging Worker upload was blocked or could not be verified.");
    this.name = "StagingUploadError";
  }
}

export async function uploadVerifiedStagingWorker(
  artifact: StagingWorkerArtifact,
  release: {
    tenantId: string;
    projectId: string;
    sourceDigest: string;
  },
  env: Env,
  http: typeof fetch = fetch
): Promise<StagingUploadResult> {
  // Two deliberate switches stop accidental use in the ordinary web server.
  // A public request NEVER supplies any of these values.
  const accountId = env.BUILDRX_MANAGED_WFP_ACCOUNT_ID?.trim() ?? "";
  const token = env.BUILDRX_MANAGED_WFP_STAGING_UPLOAD_TOKEN?.trim() ?? "";
  const key = env.BUILDRX_MANAGED_WFP_ARTIFACT_VERIFY_KEY ?? "";
  const builderId = env.BUILDRX_MANAGED_WFP_TRUSTED_BUILDER_ID?.trim() ?? "";
  if (env.BUILDRX_MANAGED_WFP_STAGING_UPLOAD_ENABLED !== "true" ||
      env.BUILDRX_MANAGED_WFP_EXECUTOR_CONTEXT !== "isolated_deploy_worker" ||
      env.BUILDRX_MANAGED_WFP_STAGING_NAMESPACE !== NAMESPACE ||
      !ACCOUNT.test(accountId) || !token ||
      key.length < 32 || !builderId) {
    throw new StagingUploadError();
  }

  let verified: { workerName: string; moduleSha256: string };
  try {
    verified = verifyStagingArtifact(artifact, key, { ...release, builderId });
    // A managed Worker name MUST come from the signed tenant identity,
    // never a client-provided slug or pathname.
    if (verified.workerName !== managedWorkerName(release.tenantId, release.projectId)) {
      throw new Error("Worker identity mismatch");
    }
  } catch {
    throw new StagingUploadError();
  }

  // The scoped token should be allowed to modify only the staging namespace.
  // No arbitrary URLs, Cloudflare domains, namespaces or worker names are
  // accepted from request bodies.
  const url = `https://api.cloudflare.com/client/v4/accounts/${accountId}/workers/dispatch/namespaces/${NAMESPACE}/scripts/${verified.workerName}`;
  const form = new FormData();
  form.append("metadata", new Blob([JSON.stringify({
    main_module: "worker.mjs",
    compatibility_date: "2026-11-07",
    tags: ["buildrx", "staging", "managed-v1"],
  })], { type: "application/json" }));
  form.append("worker.mjs", new File([artifact.module], "worker.mjs", {
    type: "application/javascript+module",
  }));

  try {
    const response = await http(url, {
      method: "PUT",
      headers: { Authorization: `Bearer ${token}` },
      body: form,
      cache: "no-store",
      signal: AbortSignal.timeout(15_000),
    });
    // Cloudflare can return a non-empty error payload with status 200;
    // require both HTTP success and explicit Cloudflare success.
    if (!response.ok) throw new Error("Cloudflare upload declined");
    const payload = await response.json() as { success?: unknown };
    if (payload?.success !== true) throw new Error("Cloudflare upload not confirmed");
  } catch {
    // Never return token, raw provider error, account ID or script source.
    throw new StagingUploadError();
  }
  return {
    status: "uploaded_unverified",
    workerName: verified.workerName,
    artifactSha256: verified.moduleSha256,
    deployed: false,
    url: null,
  };
}
