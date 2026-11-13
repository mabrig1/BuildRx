/**
 * Exact-host, nonce-bound HTTP smoke probe of a previously deployed release.
 *
 * This is not full App Router/DB/auth certification. The future staging
 * dispatcher must support private preview routing before live promotion.
 */
import { randomBytes } from "node:crypto";
import { isIP } from "node:net";
import { managedWfpScriptName } from "./cloudflare-wfp-artifact";

const HOSTNAME = /^(?=.{4,253}$)[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$/;
const LABEL = /^[a-z0-9][a-z0-9-]{0,62}$/;
const DIGEST = /^[a-f0-9]{64}$/;

export interface WfpSmokeInput {
  ownerId: string;
  projectId: string;
  expectedArtifactDigest: string;
  // Both values originate from trusted operator-owned routing metadata.
  operatorDispatchHostname: string;
  verifiedHostname: string;
}

export interface WfpSmokeResult {
  passed: boolean;
  checks: {
    https: boolean;
    nonceEcho: boolean;
    artifactDigestEcho: boolean;
    workerIdentityEcho: boolean;
  };
  // A single healthy endpoint never authorizes public LIVE promotion.
}

export async function probeWfpWorker(
  input: WfpSmokeInput, http: typeof fetch = fetch
): Promise<WfpSmokeResult> {
  const failure: WfpSmokeResult = {
    passed: false,
    checks: { https: false, nonceEcho: false, artifactDigestEcho: false, workerIdentityEcho: false },
  };
  const configuredHost = process.env.BUILDRX_WFP_DISPATCH_HOST?.trim() ?? "";
  if (!DIGEST.test(input.expectedArtifactDigest) ||
      !HOSTNAME.test(input.operatorDispatchHostname) ||
      isIP(input.operatorDispatchHostname) !== 0 ||
      !configuredHost || configuredHost !== input.operatorDispatchHostname) {
    return failure;
  }
  const suffix = "." + configuredHost;
  if (!input.verifiedHostname.endsWith(suffix) ||
      !LABEL.test(input.verifiedHostname.slice(0, -suffix.length))) return failure;

  let scriptName: string;
  try { scriptName = managedWfpScriptName(input.ownerId, input.projectId); }
  catch { return failure; }
  // WfP's dynamic dispatch contract (PR #48) uses verified subdomains,
  // never a URL path containing a caller-selected Worker identity.
  const url = "https://" + input.verifiedHostname + "/__buildrx/health";
  const nonce = randomBytes(16).toString("base64url");
  try {
    const response = await http(url, {
      method: "GET",
      headers: {
        "X-BuildRx-Probe-Nonce": nonce, Accept: "application/json",
        "Cache-Control": "no-store",
      },
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
      workerIdentityEcho: response.headers.get("x-buildrx-worker-id") === scriptName,
    };
    return { passed: Object.values(checks).every(Boolean), checks };
  } catch {
    return failure;
  }
}
