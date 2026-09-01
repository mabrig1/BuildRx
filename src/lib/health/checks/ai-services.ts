import Anthropic from "@anthropic-ai/sdk";

import { classifyThrown } from "@/lib/health/error-response";
import { withCircuitBreaker } from "@/lib/health/retry";
import type { CheckResult, HealthStatus } from "@/lib/health/types";
import { isNvidiaConfigured, nvidiaApiKey, nvidiaBaseUrl } from "@/lib/ai/nvidia";
import {
  isOpenRouterConfigured,
  openrouterApiKey,
  openrouterBaseUrl,
} from "@/lib/ai/openrouter";

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

async function probeOpenRouter(): Promise<{ ok: boolean; detail: string }> {
  return withCircuitBreaker("openrouter", async () => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), PROBE_TIMEOUT_MS);
    try {
      const response = await fetch(`${openrouterBaseUrl()}/models`, {
        headers: { Authorization: `Bearer ${openrouterApiKey()}` },
        signal: controller.signal,
      });
      if (!response.ok) {
        throw new Error(`OpenRouter API returned ${response.status}`);
      }
      return { ok: true, detail: "OpenRouter API reachable." };
    } finally {
      clearTimeout(timeout);
    }
  });
}

/**
 * AI services check: confirms the AI providers actually in use are
 * reachable with the current keys, not just "an env var is set".
 * OpenRouter is primary, NVIDIA is the fallback, and Anthropic is probed
 * only when explicitly enabled (ANTHROPIC_ENABLED=true), so an unused,
 * unfunded Anthropic key cannot drag this check to "degraded".
 */
export async function checkAiServices(): Promise<{ result: CheckResult }> {
  const startedAt = Date.now();
  const checkedAt = new Date().toISOString();

  const anthropicFlag = process.env.ANTHROPIC_ENABLED?.trim().toLowerCase();
  const anthropicEnabled =
    (anthropicFlag === "true" || anthropicFlag === "1") &&
    Boolean(process.env.ANTHROPIC_API_KEY?.trim());
  const openrouterConfigured = isOpenRouterConfigured();
  const nvidiaConfigured = isNvidiaConfigured();

  if (!openrouterConfigured && !nvidiaConfigured && !anthropicEnabled) {
    return {
      result: {
        subsystem: "ai",
        label: "AI services",
        status: "degraded",
        summary:
          "No AI provider configured — set OPENROUTER_API_KEY or NVIDIA_API_KEY; chat and agent builds use deterministic fallbacks until then.",
        detail: { openrouterConfigured, nvidiaConfigured, anthropicEnabled },
        checkedAt,
        durationMs: Date.now() - startedAt,
      },
    };
  }

  const probes: Record<string, { ok: boolean; detail: string }> = {};
  const errors: string[] = [];

  if (openrouterConfigured) {
    try {
      probes.openrouter = await probeOpenRouter();
    } catch (error) {
      probes.openrouter = { ok: false, detail: classifyThrown(error, "ai").cause };
      errors.push(`OpenRouter: ${probes.openrouter.detail}`);
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
  if (anthropicEnabled) {
    try {
      probes.anthropic = await probeAnthropic();
    } catch (error) {
      probes.anthropic = { ok: false, detail: classifyThrown(error, "ai").cause };
      errors.push(`Anthropic: ${probes.anthropic.detail}`);
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
      detail: { openrouterConfigured, nvidiaConfigured, anthropicEnabled, probes },
      checkedAt,
      durationMs: Date.now() - startedAt,
    },
  };
}
