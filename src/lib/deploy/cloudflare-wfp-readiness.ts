/**
 * Read-only Workers for Platforms account/namespace check. This is separate
 * from Workers Builds authorization and must not enable uploads or publication.
 */
const ACCOUNT = /^[0-9a-f]{32}$/i;
const NAMESPACE = /^[a-z][a-z0-9-]{0,62}$/;

export interface WfpReadiness {
  strategy: "workers_for_platforms";
  mode: "read_only";
  canPublish: false;
  status: "missing_configuration" | "invalid_configuration" |
    "namespace_unverified" | "namespace_read_verified";
  checks: { configured: boolean; namespaceRead: boolean };
  blockers: string[];
}

export async function readWfpNamespaceReadiness(
  env: Record<string, string | undefined>, http: typeof fetch = fetch
): Promise<WfpReadiness> {
  const account = env.BUILDRX_MANAGED_WFP_ACCOUNT_ID?.trim() ?? "";
  const token = env.BUILDRX_MANAGED_WFP_API_TOKEN?.trim() ?? "";
  const namespace = env.BUILDRX_MANAGED_WFP_NAMESPACE?.trim() ?? "";
  const configured = Boolean(account && token && namespace);
  const report: WfpReadiness = {
    strategy: "workers_for_platforms", mode: "read_only",
    canPublish: false, status: "missing_configuration",
    checks: { configured, namespaceRead: false },
    blockers: [
      "isolated_builder_unavailable",
      "durable_tenant_quota_unverified",
      "dispatch_routing_unverified",
      "immutable_release_attestation_unavailable",
      "app_smoke_and_rollback_unverified",
    ],
  };
  if (!configured) {
    report.blockers.push("operator_configuration_missing");
    return report;
  }
  if (!ACCOUNT.test(account) || !NAMESPACE.test(namespace) || token.length < 15) {
    report.status = "invalid_configuration";
    report.blockers.push("operator_configuration_invalid");
    return report;
  }
  const url = "https://api.cloudflare.com/client/v4/accounts/" +
    account + "/workers/dispatch/namespaces/" + namespace;
  try {
    const response = await http(url, {
      method: "GET",
      headers: { Authorization: "Bearer " + token, Accept: "application/json" },
      redirect: "manual",
      cache: "no-store",
      signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) throw new Error("Namespace HTTP check failed");
    const body: unknown = await response.json();
    if (!body || typeof body !== "object" ||
        (body as { success?: unknown }).success !== true ||
        !(body as { result?: unknown }).result ||
        typeof (body as { result: unknown }).result !== "object") {
      throw new Error("Invalid provider response");
    }
    report.status = "namespace_read_verified";
    report.checks.namespaceRead = true;
    // Still cannot publish: dispatch worker, isolated build, cost and rollback
    // must be independently certified before any operator upload.
  } catch {
    report.status = "namespace_unverified";
    report.blockers.push("namespace_unverified");
  }
  return report;
}
