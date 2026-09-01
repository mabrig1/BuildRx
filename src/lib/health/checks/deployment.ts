import { classifyThrown } from "@/lib/health/error-response";
import type { CheckResult, HealthStatus } from "@/lib/health/types";
import { isCloudflareApiConfigured } from "@/lib/cloudflare/config";
import { verifyCloudflareApiToken } from "@/lib/cloudflare/api";

const PING_TIMEOUT_MS = 5000;

function appUrl(): string | undefined {
  const raw = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (!raw) return undefined;
  try {
    return new URL(raw).toString();
  } catch {
    return undefined;
  }
}

/**
 * Deployment Agent: reports the running deployment's identity
 * (Vercel env/commit, when present) and confirms the public app URL
 * actually answers. No fix proposals — deploy problems are fixed by
 * pushing a corrected commit or environment variable, not SQL.
 */
export async function checkDeployment(): Promise<{ result: CheckResult }> {
  const startedAt = Date.now();
  const checkedAt = new Date().toISOString();

  const vercelEnv = process.env.VERCEL_ENV; // "production" | "preview" | "development"
  const commitSha = process.env.VERCEL_GIT_COMMIT_SHA;
  const url = appUrl();

  const issues: string[] = [];
  if (!url) issues.push("NEXT_PUBLIC_APP_URL is not set or invalid");

  const cloudflare = {
    configured: isCloudflareApiConfigured(),
    reachable: false,
  };
  if (cloudflare.configured) {
    try {
      await verifyCloudflareApiToken();
      cloudflare.reachable = true;
    } catch {
      issues.push("Cloudflare API token verification failed");
    }
  } else {
    issues.push("Cloudflare edge API is not configured");
  }

  let reachable: boolean | null = null;
  let pingDetail = "Not checked — no app URL configured.";
  if (url) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), PING_TIMEOUT_MS);
      try {
        const response = await fetch(url, {
          method: "GET",
          redirect: "manual",
          signal: controller.signal,
        });
        // 3xx counts as reachable (auth/marketing redirects are expected).
        reachable = response.status < 500;
        pingDetail = `Responded with ${response.status}.`;
        if (!reachable) issues.push(`App URL responded with ${response.status}`);
      } finally {
        clearTimeout(timeout);
      }
    } catch (error) {
      reachable = false;
      pingDetail = classifyThrown(error, "deployment").cause;
      issues.push(`App URL unreachable: ${pingDetail}`);
    }
  }

  const status: HealthStatus =
    issues.length === 0 ? "healthy" : reachable === false ? "down" : "degraded";

  const summary =
    issues.length === 0
      ? `Deployment reachable${vercelEnv ? ` (${vercelEnv})` : ""}.`
      : issues.join("; ");

  return {
    result: {
      subsystem: "deployment",
      label: "Deployment",
      status,
      summary,
      detail: {
        vercelEnv: vercelEnv ?? null,
        commitSha: commitSha ?? null,
        appUrl: url ?? null,
        reachable,
        pingDetail,
        cloudflare,
      },
      checkedAt,
      durationMs: Date.now() - startedAt,
    },
  };
}
