/**
 * NVIDIA provider adapter — a thin wrapper around the existing
 * src/lib/ai/nvidia.ts module so NVIDIA can sit in the same registry as
 * every other provider. Deliberately does not modify nvidia.ts at all;
 * every other feature that already depends on it keeps working exactly
 * as before.
 */

import {
  createChatCompletion,
  isNvidiaConfigured,
  nvidiaTextModel,
  streamChatCompletion,
  type NvidiaMessage,
} from "@/lib/ai/nvidia";
import type { AiMessage, AiProvider } from "@/lib/ai/providers/types";

function toNvidiaMessages(messages: AiMessage[], system?: string): NvidiaMessage[] {
  const withSystem: AiMessage[] = system
    ? [{ role: "system", content: system }, ...messages]
    : messages;
  return withSystem.map((m) => ({ role: m.role, content: m.content }));
}

export const nvidiaProvider: AiProvider = {
  id: "nvidia",
  label: "NVIDIA",
  isConfigured: isNvidiaConfigured,
  // NVIDIA's existing model catalog (text/code/vision/etc.) is served by
  // GET /api/ai/models — this provider entry represents the general
  // chat-capable text model for the multi-provider surface.
  models: () => [{ id: nvidiaTextModel(), label: "NVIDIA (configured default)" }],
  defaultModel: nvidiaTextModel,
  async createCompletion(messages, options = {}) {
    const result = await createChatCompletion(
      toNvidiaMessages(messages, options.system),
      {
        model: options.model,
        maxTokens: options.maxTokens,
        temperature: options.temperature,
        topP: options.topP,
      }
    );
    return result;
  },
  async streamCompletion(messages, options = {}) {
    return streamChatCompletion(toNvidiaMessages(messages, options.system), {
      model: options.model,
      maxTokens: options.maxTokens,
      temperature: options.temperature,
      topP: options.topP,
    });
  },
};
