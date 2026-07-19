/**
 * Central registry for every AI provider. This is the one place that
 * knows the full provider list — everything else (routes, UI) asks the
 * registry rather than importing individual adapters.
 */

import { anthropicProvider } from "@/lib/ai/providers/anthropic";
import { deepseekProvider } from "@/lib/ai/providers/deepseek";
import { geminiProvider } from "@/lib/ai/providers/gemini";
import { grokProvider } from "@/lib/ai/providers/grok";
import { nvidiaProvider } from "@/lib/ai/providers/nvidia";
import { openaiProvider } from "@/lib/ai/providers/openai";
import type { AiProvider, AiProviderId } from "@/lib/ai/providers/types";

const PROVIDERS: Record<AiProviderId, AiProvider> = {
  nvidia: nvidiaProvider,
  openai: openaiProvider,
  anthropic: anthropicProvider,
  gemini: geminiProvider,
  deepseek: deepseekProvider,
  grok: grokProvider,
};

/** All providers, in the order they should appear in the UI. */
export const PROVIDER_IDS: AiProviderId[] = [
  "nvidia",
  "anthropic",
  "openai",
  "gemini",
  "deepseek",
  "grok",
];

export function getProvider(id: AiProviderId): AiProvider {
  return PROVIDERS[id];
}

export function listProviders(): AiProvider[] {
  return PROVIDER_IDS.map((id) => PROVIDERS[id]);
}

/** Providers with a valid API key/config in the current environment. */
export function listConfiguredProviders(): AiProvider[] {
  return listProviders().filter((p) => p.isConfigured());
}

export function isValidProviderId(value: string): value is AiProviderId {
  return value in PROVIDERS;
}
