import { createHash } from "node:crypto";
import { fileWithEmbeddedCredential, isDeploymentSourcePath } from "./source";

export interface ManagedSourceFile { path: string; content: string }

/** Future durable release contract. No record is persisted by preflight.
 * Only a trusted builder/verifier may populate deployment and smoke evidence.
 */
export interface ManagedRelease {
  tenantId: string;
  projectId: string;
  sourceDigest: string;
  providerDeploymentId: string | null;
  artifactHash: string | null;
  verifiedHostname: string | null;
  previousGoodReleaseId: string | null;
}

export interface SourceVerification {
  sourceDigest: string;
  passed: boolean;
}

export type ManagedBlocker =
  | "operator_configuration_missing"
  | "operator_authorization_unverified"
  | "project_not_ready"
  | "source_invalid"
  | "source_credentials_detected"
  | "source_verification_missing"
  | "source_verification_stale"
  | "source_verification_failed"
  | "tenant_isolation_unverified"
  | "quota_policy_unverified"
  | "runtime_compatibility_unverified"
  | "rollback_unverified"
  | "hostname_and_app_tests_unverified"
  | "managed_execution_unavailable";

/** Read-only diagnostics. Presence never means valid credentials or permission. */
export function operatorConfigurationPresent(env: Record<string, string | undefined>): boolean {
  return [
    "BUILDRX_MANAGED_CF_ACCOUNT_ID",
    "BUILDRX_MANAGED_CF_BUILDS_TOKEN",
    "BUILDRX_MANAGED_CF_BUILD_TOKEN_UUID",
    "BUILDRX_MANAGED_SOURCE_TOKEN",
  ].every((name) => Boolean(env[name]?.trim()));
}

function digestSource(files: ManagedSourceFile[]): string {
  // Versioned, unambiguous serialization. Order of database rows is irrelevant.
  const ordered = [...files].sort((a, b) => a.path < b.path ? -1 : a.path > b.path ? 1 : 0);
  return createHash("sha256")
    .update(JSON.stringify(["buildrx-source-v1", ordered.map(({ path, content }) => [path, content])]))
    .digest("hex");
}

function validSource(files: ManagedSourceFile[]): boolean {
  const paths = new Set<string>();
  let bytes = 0;
  if (files.length < 3 || files.length > 500) return false;
  for (const file of files) {
    // Canonical project-relative paths only; reject aliases before hashing.
    if (!file.path || file.path.startsWith("/") || /[\\:]/.test(file.path) || [...file.path].some((char) => char.charCodeAt(0) < 32) ||
        file.path.split("/").some((part) => !part || part === "." || part === "..") ||
        paths.has(file.path)) return false;
    paths.add(file.path);
    bytes += Buffer.byteLength(file.content, "utf8");
    if (bytes > 3_000_000) return false;
  }
  const app = ["src/app", "app"].some((root) =>
    paths.has(root + "/page.tsx") && paths.has(root + "/layout.tsx"));
  if (!app) return false;
  try {
    const pkg = JSON.parse(files.find((file) => file.path === "package.json")?.content ?? "");
    return typeof pkg?.dependencies?.next === "string" && Boolean(pkg.dependencies.next.trim());
  } catch { return false; }
}

export function evaluateManagedPreflight(input: {
  projectStatus: string;
  files: ManagedSourceFile[];
  operatorConfigured: boolean;
  /** Trusted server evidence only. Never accept this from a request body. */
  verification: SourceVerification | null;
}) {
  const blockers: ManagedBlocker[] = [
    input.operatorConfigured ? "operator_authorization_unverified" : "operator_configuration_missing",
    "tenant_isolation_unverified",
    "quota_policy_unverified",
    "runtime_compatibility_unverified",
    "rollback_unverified",
    "hostname_and_app_tests_unverified",
    "managed_execution_unavailable",
  ];
  if (input.projectStatus !== "ready") blockers.push("project_not_ready");
  const source = input.files.filter((file) => isDeploymentSourcePath(file.path));
  let sourceDigest: string | null = null;
  if (!validSource(source)) blockers.push("source_invalid");
  else if (fileWithEmbeddedCredential(source)) blockers.push("source_credentials_detected");
  else sourceDigest = digestSource(source);

  if (!input.verification) blockers.push("source_verification_missing");
  else if (!sourceDigest || input.verification.sourceDigest !== sourceDigest)
    blockers.push("source_verification_stale");
  else if (!input.verification.passed) blockers.push("source_verification_failed");

  return {
    mode: "preflight_only" as const,
    canPublish: false as const,
    deployed: false as const,
    sourceDigest,
    blockers,
  };
}
