/**
 * xAI Grok — listed as an "optional placeholder" provider. The
 * implementation is real (same OpenAI-compatible wire format as the
 * other adapters, against api.x.ai), but the provider only reports
 * itself as configured — and only shows up in the UI — once XAI_API_KEY
 * is set. Nothing else in the app depends on Grok being available.
 */

import {
  createOpenAiCompatibleCompletion,
  streamOpenAiCompatibleCompletion,
} from "@/lib/ai/providers/openai-compatible";
import type { AiProvider } from "@/lib/ai/providers/types";

const BASE_URL = "https://api.x.ai/v1";
const DEFAULT_MODEL = "grok-4";

const MODELS = [
  { id: "grok-4", label: "Grok 4", contextWindow: 256_000, pricing: { inputPer1M: 3, outputPer1M: 15 } },
  { id: "grok-4-fast", label: "Grok 4 Fast", contextWindow: 2_000_000, pricing: { inputPer1M: 0.2, outputPer1M: 0.5 } },
];

function apiKey() {
  return process.env.XAI_API_KEY?.trim() || undefined;
}

export const grokProvider: AiProvider = {
  id: "grok",
  label: "Grok (xAI)",
  isConfigured: () => Boolean(apiKey()),
  supportsTools: true,
  models: () => MODELS,
  defaultModel: () => process.env.XAI_MODEL?.trim() || DEFAULT_MODEL,
  async createCompletion(messages, options = {}) {
    const key = apiKey();
    if (!key) throw new Error("XAI_API_KEY is not configured.");
    return createOpenAiCompatibleCompletion(
      { providerId: "grok", baseUrl: BASE_URL, apiKey: key, defaultModel: grokProvider.defaultModel() },
      messages,
      options
    );
  },
  async streamCompletion(messages, options = {}) {
    const key = apiKey();
    if (!key) throw new Error("XAI_API_KEY is not configured.");
    return streamOpenAiCompatibleCompletion(
      { providerId: "grok", baseUrl: BASE_URL, apiKey: key, defaultModel: grokProvider.defaultModel() },
      messages,
      options
    );
  },
};
