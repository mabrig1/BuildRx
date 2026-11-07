/**
 * Read-only Cloudflare operator readiness verification for BuildRx.
 *
 * This checks the operator's configured Cloudflare identity and Builds token.
 * It cannot create/modify Workers, credentials, repositories, builds, or releases.
 * It cannot prove per-tenant isolation, actual GitHub App installation or a
 * runnable Next.js deployment. Those must stay separately blocked.
 *
 * API reference (verified 2026-11-07):
 * https://developers.cloudflare.com/workers/ci-cd/builds/api-reference/
 */
export interface OperatorReadiness {
  mode: "operator_read_only";
  readyForManagedPublishing: false;
  status: "missing_configuration" | "invalid_configuration" | "authorization_unverified" | "account_access_verified";
  checks: {
    configured: boolean;
    workerScriptsRead: boolean;
    buildsTokensRead: boolean;
    configuredBuildTokenPresent: boolean;
    sourceCredentialPresent: boolean;
  };
  blockers: string[];
}

type Env = Record<string, string | undefined>;
type CloudflareList = { success?: boolean; result?: unknown };
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ACCOUNT_ID = /^[a-f0-9]{32}$/i;

export async function checkCloudflareOperatorReadiness(
  env: Env,
  http: typeof fetch = fetch
): Promise<OperatorReadiness> {
  const accountId = env.BUILDRX_MANAGED_CF_ACCOUNT_ID?.trim() ?? "";
  const apiToken = env.BUILDRX_MANAGED_CF_BUILDS_TOKEN?.trim() ?? "";
  const buildTokenUuid = env.BUILDRX_MANAGED_CF_BUILD_TOKEN_UUID?.trim() ?? "";
  const sourceCredentialPresent = Boolean(env.BUILDRX_MANAGED_SOURCE_TOKEN?.trim());
  const configured = Boolean(accountId && apiToken && buildTokenUuid && sourceCredentialPresent);
  const checks: OperatorReadiness["checks"] = {
    configured, workerScriptsRead: false, buildsTokensRead: false,
    configuredBuildTokenPresent: false, sourceCredentialPresent,
  };
  const result: OperatorReadiness = {
    mode: "operator_read_only", readyForManagedPublishing: false,
    status: "missing_configuration", checks,
    blockers: ["managed_execution_unavailable", "tenant_isolation_unverified",
      "quota_policy_unverified", "rollback_unverified", "hostname_and_app_tests_unverified"],
  };

  // Presence of a token never grants permission; do not make a provider call
  // until all settings are present and path parameters are safe.
  if (!configured) {
    result.blockers.push("operator_configuration_missing");
    return result;
  }
  if (!ACCOUNT_ID.test(accountId) || !UUID.test(buildTokenUuid)) {
    result.status = "invalid_configuration";
    result.blockers.push("operator_configuration_invalid");
    return result;
  }

  const endpoint = `https://api.cloudflare.com/client/v4/accounts/${accountId}`;
  const headers = { Authorization: `Bearer ${apiToken}`, Accept: "application/json" };
  async function safeList(url: string): Promise<unknown[] | null> {
    try {
      const response = await http(url, {
        method: "GET", headers, cache: "no-store",
        signal: AbortSignal.timeout(8000),
      });
      if (!response.ok) return null;
      const body = await response.json() as CloudflareList;
      return body.success === true && Array.isArray(body.result) ? body.result : null;
    } catch {
      // Never leak provider error bodies, HTTP headers or supplied tokens.
      return null;
    }
  }

  const scripts = await safeList(`${endpoint}/workers/scripts`);
  checks.workerScriptsRead = scripts !== null;
  const tokens = await safeList(`${endpoint}/builds/tokens`);
  checks.buildsTokensRead = tokens !== null;
  if (tokens) {
    checks.configuredBuildTokenPresent = tokens.some((item) => {
      if (!item || typeof item !== "object") return false;
      return (item as Record<string, unknown>).build_token_uuid === buildTokenUuid;
    });
  }

  if (checks.workerScriptsRead && checks.buildsTokensRead && checks.configuredBuildTokenPresent) {
    result.status = "account_access_verified";
    // This is deliberately *not* a publish-ready result.
    result.blockers.push("operator_worker_and_github_binding_unverified");
  } else {
    result.status = "authorization_unverified";
    result.blockers.push("operator_authorization_unverified");
  }
  return result;
}
