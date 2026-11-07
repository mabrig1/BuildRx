/**
 * One strictly scoped smoke test for a previously uploaded WfP artifact.
 * Only the trusted coordinator should use it. This is NOT full application
 * certification; auth, data writes and integration checks are separate.
 */
import { randomBytes } from "node:crypto";
import { managedWfpScriptName } from "./cloudflare-wfp-artifact";

const HOSTNAME = /^(?=.{4,253}$)[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$/;
const DIGEST = /^[a-f0-9]{64}$/;

export interface WfpSmokeInput {
  projectId: string;
  expectedArtifactDigest: string;
  // This is the operator-controlled dispatch hostname, not a URL from a user.
  operatorDispatchHostname: string;
  // Expected public hostname must be supplied separately by the trusted
  // coordinator after verifying it matches operator-owned routing config.
  verifiedHostname: string;
}

export interface WfpSmokeResult {
  passed: boolean;
  checks: { https: boolean; nonceEcho: boolean; artifactDigestEcho: boolean };
  // No page URL or "live" state is issued by this limited check.
}

export async function probeWfpWorker(
  input: WfpSmokeInput, http: typeof fetch = fetch
): Promise<WfpSmokeResult> {
  const failure: WfpSmokeResult = {
    passed: false, checks: { https: false, nonceEcho: false, artifactDigestEcho: false },
  };
  if (!DIGEST.test(input.expectedArtifactDigest) ||
      !HOSTNAME.test(input.operatorDispatchHostname) ||
      input.verifiedHostname !== input.operatorDispatchHostname) return failure;

  let scriptName: string;
  try { scriptName = managedWfpScriptName(input.projectId); }
  catch { return failure; }
  const url = "https://" + input.operatorDispatchHostname + "/" + scriptName + "/__buildrx/health";
  // Avoid redirects and cache replay: a backend challenge must be echoed.
  const nonce = randomBytes(16).toString("base64url");
  try {
    const response = await http(url, {
      method: "GET",
      headers: { "X-BuildRx-Probe-Nonce": nonce, Accept: "application/json",
        "Cache-Control": "no-store" },
      redirect: "manual",
      cache: "no-store",
      signal: AbortSignal.timeout(8000),
    });
    if (response.status !== 200) return failure;
    const checks = {
      https: true,
      nonceEcho: response.headers.get("x-buildrx-probe-nonce") === nonce,
      artifactDigestEcho: response.headers.get("x-buildrx-artifact-sha256") ===
        input.expectedArtifactDigest,
    };
    return { passed: Object.values(checks).every(Boolean), checks };
  } catch {
    return failure;
  }
}
