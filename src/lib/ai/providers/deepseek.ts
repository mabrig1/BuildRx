import {
  createOpenAiCompatibleCompletion,
  streamOpenAiCompatibleCompletion,
} from "@/lib/ai/providers/openai-compatible";
import type { AiProvider } from "@/lib/ai/providers/types";

const BASE_URL = "https://api.deepseek.com/v1";
const DEFAULT_MODEL = "deepseek-chat";

const MODELS = [
  { id: "deepseek-chat", label: "DeepSeek Chat (V3)", contextWindow: 64_000, pricing: { inputPer1M: 0.27, outputPer1M: 1.1 } },
  { id: "deepseek-reasoner", label: "DeepSeek Reasoner (R1)", contextWindow: 64_000, pricing: { inputPer1M: 0.55, outputPer1M: 2.19 } },
];

function apiKey() {
  return process.env.DEEPSEEK_API_KEY?.trim() || undefined;
}

export const deepseekProvider: AiProvider = {
  id: "deepseek",
  label: "DeepSeek",
  isConfigured: () => Boolean(apiKey()),
  supportsTools: true,
  models: () => MODELS,
  defaultModel: () => process.env.DEEPSEEK_MODEL?.trim() || DEFAULT_MODEL,
  async createCompletion(messages, options = {}) {
    const key = apiKey();
    if (!key) throw new Error("DEEPSEEK_API_KEY is not configured.");
    return createOpenAiCompatibleCompletion(
      { providerId: "deepseek", baseUrl: BASE_URL, apiKey: key, defaultModel: deepseekProvider.defaultModel() },
      messages,
      options
    );
  },
  async streamCompletion(messages, options = {}) {
    const key = apiKey();
    if (!key) throw new Error("DEEPSEEK_API_KEY is not configured.");
    return streamOpenAiCompatibleCompletion(
      { providerId: "deepseek", baseUrl: BASE_URL, apiKey: key, defaultModel: deepseekProvider.defaultModel() },
      messages,
      options
    );
  },
};
