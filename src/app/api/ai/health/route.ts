import { NextResponse } from "next/server";

import { announceConfigurationOnce, validateConfiguration } from "@/lib/config/validate";
import { nvidiaApiKey, nvidiaBaseUrl } from "@/lib/ai/nvidia";
import { resolvedModelPlan } from "@/lib/ai/models";

export const maxDuration = 30;

const PROBE_TIMEOUT_MS = 10_000;

/** Failure categories, deliberately coarse — never the provider's raw text. */
type ErrorCategory =
  | "not_configured"
  | "auth_rejected"
  | "rate_limited"
  | "unreachable"
  | "timeout"
  | "upstream_error"
  | null;

function categorize(status: number): ErrorCategory {
  if (status === 401 || status === 403) return "auth_rejected";
  if (status === 429) return "rate_limited";
  if (status >= 500) return "upstream_error";
  return "upstream_error";
}

/**
 * GET /api/ai/health — is the AI provider actually usable right now?
 *
 * Makes one real request to the provider and reports reachability,
 * latency and a sanitized failure category. Public by design (it is a
 * liveness probe), which is exactly why it returns no key, no model
 * variable values, and no raw upstream error text — only the category.
 */
export async function GET() {
  announceConfigurationOnce();
  const config = validateConfiguration();
  const startedAt = Date.now();

  const key = nvidiaApiKey();
  if (!key) {
    return NextResponse.json(
      {
        status: "not_configured",
        configured: false,
        reachable: false,
        latencyMs: null,
        httpStatus: null,
        errorCategory: "not_configured" satisfies ErrorCategory,
        config,
      },
      { status: 503 }
    );
  }

  let httpStatus: number | null = null;
  let reachable = false;
  let errorCategory: ErrorCategory = null;

  try {
    const response = await fetch(`${nvidiaBaseUrl()}/models`, {
      headers: { Authorization: `Bearer ${key}` },
      signal: AbortSignal.timeout(PROBE_TIMEOUT_MS),
    });
    httpStatus = response.status;
    reachable = response.ok;
    if (!response.ok) errorCategory = categorize(response.status);
    // Body is drained but never returned — it is large and unnecessary.
    await response.arrayBuffer().catch(() => undefined);
  } catch (error) {
    const name = error instanceof Error ? error.name : "";
    errorCategory = name === "TimeoutError" ? "timeout" : "unreachable";
  }

  const latencyMs = Date.now() - startedAt;
  const models = await resolvedModelPlan().catch(() => null);

  const status = reachable ? "healthy" : errorCategory === "rate_limited" ? "degraded" : "down";

  return NextResponse.json(
    {
      status,
      configured: true,
      reachable,
      latencyMs,
      httpStatus,
      errorCategory,
      /** Model ids are not secrets; the variables that hold them are. */
      models,
      config,
    },
    { status: reachable ? 200 : 503 }
  );
}
