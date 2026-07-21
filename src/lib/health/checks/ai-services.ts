import Anthropic from "@anthropic-ai/sdk";

import { classifyThrown } from "@/lib/health/error-response";
import { withCircuitBreaker } from "@/lib/health/retry";
import type { CheckResult, HealthStatus } from "@/lib/health/types";
import { isNvidiaConfigured, nvidiaApiKey, nvidiaBaseUrl } from "@/lib/ai/nvidia";

const PROBE_TIMEOUT_MS = 5000;

async function probeAnthropic(): Promise<{ ok: boolean; detail: string }> {
  return withCircuitBreaker("anthropic", async () => {
    const client = new Anthropic({ timeout: PROBE_TIMEOUT_MS });
    // Lightweight, non-billable call — confirms the key + connectivity.
    await client.models.list({ limit: 1 });
    return { ok: true, detail: "Anthropic API reachable." };
  });
}

async function probeNvidia(): Promise<{ ok: boolean; detail: string }> {
  return withCircuitBreaker("nvidia", async () => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), PROBE_TIMEOUT_MS);
    try {
      const response = await fetch(`${nvidiaBaseUrl()}/models`, {
        headers: { Authorization: `Bearer ${nvidiaApiKey()}` },
        signal: controller.signal,
      });
      if (!response.ok) {
        throw new Error(`NVIDIA API returned ${response.status}`);
      }
      return { ok: true, detail: "NVIDIA Inference API reachable." };
    } finally {
      clearTimeout(timeout);
    }
  });
}

/**
 * AI services check: confirms configured AI providers (Anthropic,
 * NVIDIA) are actually reachable with the current keys, not just "an
 * env var is set". No fix proposals here — the only remedy is
 * setting/rotating the provider key in the deployment environment.
 */
export async function checkAiServices(): Promise<{ result: CheckResult }> {
  const startedAt = Date.now();
  const checkedAt = new Date().toISOString();

  const anthropicConfigured = Boolean(process.env.ANTHROPIC_API_KEY);
  const nvidiaConfigured = isNvidiaConfigured();

  if (!anthropicConfigured && !nvidiaConfigured) {
    return {
      result: {
        subsystem: "ai",
        label: "AI services",
        status: "degraded",
        summary: "No AI provider configured — chat and agent builds run in demo/mock mode.",
        detail: { anthropicConfigured, nvidiaConfigured },
        checkedAt,
        durationMs: Date.now() - startedAt,
      },
    };
  }

  const probes: Record<string, { ok: boolean; detail: string }> = {};
  const errors: string[] = [];

  if (anthropicConfigured) {
    try {
      probes.anthropic = await probeAnthropic();
    } catch (error) {
      probes.anthropic = { ok: false, detail: classifyThrown(error, "ai").cause };
      errors.push(`Anthropic: ${probes.anthropic.detail}`);
    }
  }
  if (nvidiaConfigured) {
    try {
      probes.nvidia = await probeNvidia();
    } catch (error) {
      probes.nvidia = { ok: false, detail: classifyThrown(error, "ai").cause };
      errors.push(`NVIDIA: ${probes.nvidia.detail}`);
    }
  }

  const configuredProbes = Object.values(probes);
  const allDown = configuredProbes.length > 0 && configuredProbes.every((p) => !p.ok);
  const anyDown = configuredProbes.some((p) => !p.ok);

  const status: HealthStatus = allDown ? "down" : anyDown ? "degraded" : "healthy";
  const summary =
    errors.length > 0
      ? `${errors.length} provider issue(s): ${errors.join("; ")}`
      : `${configuredProbes.length} AI provider(s) reachable.`;

  return {
    result: {
      subsystem: "ai",
      label: "AI services",
      status,
      summary,
      detail: { anthropicConfigured, nvidiaConfigured, probes },
      checkedAt,
      durationMs: Date.now() - startedAt,
    },
  };
}
