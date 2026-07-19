import {
  createOpenAiCompatibleCompletion,
  streamOpenAiCompatibleCompletion,
} from "@/lib/ai/providers/openai-compatible";
import type { AiProvider } from "@/lib/ai/providers/types";

const BASE_URL = "https://api.openai.com/v1";
const DEFAULT_MODEL = "gpt-4o-mini";

const MODELS = [
  { id: "gpt-4o", label: "GPT-4o", contextWindow: 128_000, pricing: { inputPer1M: 2.5, outputPer1M: 10 } },
  { id: "gpt-4o-mini", label: "GPT-4o mini", contextWindow: 128_000, pricing: { inputPer1M: 0.15, outputPer1M: 0.6 } },
  { id: "gpt-4.1", label: "GPT-4.1", contextWindow: 1_047_576, pricing: { inputPer1M: 2, outputPer1M: 8 } },
  { id: "gpt-4.1-mini", label: "GPT-4.1 mini", contextWindow: 1_047_576, pricing: { inputPer1M: 0.4, outputPer1M: 1.6 } },
];

function apiKey() {
  return process.env.OPENAI_API_KEY?.trim() || undefined;
}

export const openaiProvider: AiProvider = {
  id: "openai",
  label: "OpenAI",
  isConfigured: () => Boolean(apiKey()),
  models: () => MODELS,
  defaultModel: () => process.env.OPENAI_MODEL?.trim() || DEFAULT_MODEL,
  async createCompletion(messages, options = {}) {
    const key = apiKey();
    if (!key) throw new Error("OPENAI_API_KEY is not configured.");
    return createOpenAiCompatibleCompletion(
      { providerId: "openai", baseUrl: BASE_URL, apiKey: key, defaultModel: openaiProvider.defaultModel() },
      messages,
      options
    );
  },
  async streamCompletion(messages, options = {}) {
    const key = apiKey();
    if (!key) throw new Error("OPENAI_API_KEY is not configured.");
    return streamOpenAiCompatibleCompletion(
      { providerId: "openai", baseUrl: BASE_URL, apiKey: key, defaultModel: openaiProvider.defaultModel() },
      messages,
      options
    );
  },
};
