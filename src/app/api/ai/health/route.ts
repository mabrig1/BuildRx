import { NextResponse } from "next/server";

import { announceConfigurationOnce, validateConfiguration } from "@/lib/config/validate";
import { nvidiaApiKey, nvidiaBaseUrl } from "@/lib/ai/nvidia";
import { resolvedModelPlan, resolvedOpenRouterPlan } from "@/lib/ai/models";
import {
  isOpenRouterConfigured,
  openrouterApiKey,
  openrouterBaseUrl,
} from "@/lib/ai/openrouter";

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

interface ProviderProbe {
  name: "openrouter" | "nvidia";
  baseUrl: string;
  key: string;
}

interface ProviderHealth {
  name: ProviderProbe["name"];
  reachable: boolean;
  latencyMs: number;
  httpStatus: number | null;
  errorCategory: ErrorCategory;
}

/** Same priority as the actual completion chain: OpenRouter, then NVIDIA. */
function configuredProbes(): ProviderProbe[] {
  const probes: ProviderProbe[] = [];
  const openrouterKey = openrouterApiKey();
  if (openrouterKey) {
    probes.push({
      name: "openrouter",
      baseUrl: openrouterBaseUrl(),
      key: openrouterKey,
    });
  }
  const nvidiaKey = nvidiaApiKey();
  if (nvidiaKey) {
    probes.push({ name: "nvidia", baseUrl: nvidiaBaseUrl(), key: nvidiaKey });
  }
  return probes;
}

async function probeProvider(provider: ProviderProbe): Promise<ProviderHealth> {
  const startedAt = Date.now();
  let httpStatus: number | null = null;
  let reachable = false;
  let errorCategory: ErrorCategory = null;

  try {
    const response = await fetch(`${provider.baseUrl}/models`, {
      headers: { Authorization: `Bearer ${provider.key}` },
      signal: AbortSignal.timeout(PROBE_TIMEOUT_MS),
    });
    httpStatus = response.status;
    reachable = response.ok;
    if (!response.ok) errorCategory = categorize(response.status);
    await response.arrayBuffer().catch(() => undefined);
  } catch (error) {
    const name = error instanceof Error ? error.name : "";
    errorCategory = name === "TimeoutError" ? "timeout" : "unreachable";
  }

  return {
    name: provider.name,
    reachable,
    latencyMs: Date.now() - startedAt,
    httpStatus,
    errorCategory,
  };
}

/**
 * GET /api/ai/health — is the AI provider actually usable right now?
 *
 * Makes one real request to every configured provider and reports reachability,
 * latency and a sanitized failure category. Public by design (it is a
 * liveness probe), which is exactly why it returns no key, no model
 * variable values, and no raw upstream error text — only the category.
 */
export async function GET() {
  announceConfigurationOnce();
  const config = validateConfiguration();
  const probes = configuredProbes();
  if (probes.length === 0) {
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

  const providers = await Promise.all(probes.map(probeProvider));
  const primary = providers[0];
  const reachable = providers.some((provider) => provider.reachable);
  const [models, openrouterModels] = await Promise.all([
    resolvedModelPlan().catch(() => null),
    resolvedOpenRouterPlan().catch(() => null),
  ]);

  const status = reachable
    ? providers.every((provider) => provider.reachable)
      ? "healthy"
      : "degraded"
    : providers.some((provider) => provider.errorCategory === "rate_limited")
      ? "degraded"
      : "down";

  return NextResponse.json(
    {
      status,
      configured: true,
      reachable,
      /** Backward-compatible summary fields describe the primary provider. */
      latencyMs: primary.latencyMs,
      httpStatus: primary.httpStatus,
      errorCategory: primary.errorCategory,
      primaryProvider: primary.name,
      providers,
      /** Model ids are not secrets; the variables that hold them are. */
      models,
      /** Which OpenRouter model each task role resolves to right now. */
      openrouter: isOpenRouterConfigured()
        ? { configured: true, models: openrouterModels }
        : { configured: false },
      config,
    },
    { status: reachable ? 200 : 503 }
  );
}
