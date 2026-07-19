/**
 * Google Gemini provider adapter — talks to the Generative Language API
 * directly over fetch (no SDK dependency, same philosophy as the NVIDIA
 * module). Unlike the OpenAI-wire-compatible providers, Gemini has its
 * own request/response shape and passes the API key as a query param
 * rather than a bearer token.
 */

import { AiProviderError } from "@/lib/ai/providers/types";
import type {
  AiCompletion,
  AiMessage,
  AiProvider,
  AiUsage,
} from "@/lib/ai/providers/types";

const BASE_URL = "https://generativelanguage.googleapis.com/v1beta";
const DEFAULT_MODEL = "gemini-2.5-flash";

const MODELS = [
  { id: "gemini-2.5-pro", label: "Gemini 2.5 Pro", contextWindow: 1_048_576, pricing: { inputPer1M: 1.25, outputPer1M: 10 } },
  { id: "gemini-2.5-flash", label: "Gemini 2.5 Flash", contextWindow: 1_048_576, pricing: { inputPer1M: 0.3, outputPer1M: 2.5 } },
];

function apiKey() {
  return process.env.GOOGLE_API_KEY?.trim() || undefined;
}

function toGeminiContents(messages: AiMessage[]) {
  return messages
    .filter((m) => m.role !== "system")
    .map((m) => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: m.content }],
    }));
}

interface GeminiResponse {
  candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number };
  error?: { message?: string };
}

function extractText(data: GeminiResponse): string {
  return (
    data.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("") ?? ""
  );
}

function extractUsage(data: GeminiResponse): AiUsage {
  return {
    promptTokens: data.usageMetadata?.promptTokenCount ?? 0,
    completionTokens: data.usageMetadata?.candidatesTokenCount ?? 0,
  };
}

async function post(path: string, key: string, body: unknown): Promise<Response> {
  let response: Response;
  try {
    response = await fetch(`${BASE_URL}/${path}?key=${encodeURIComponent(key)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch (error) {
    const cause = error instanceof Error ? error.message : String(error);
    throw new AiProviderError(`Could not reach Gemini (${cause}).`, 503, "gemini");
  }
  if (!response.ok) {
    const data = await response.json().catch(() => null);
    throw new AiProviderError(
      data?.error?.message ?? `Gemini request failed (${response.status}).`,
      response.status,
      "gemini"
    );
  }
  return response;
}

export const geminiProvider: AiProvider = {
  id: "gemini",
  label: "Google Gemini",
  isConfigured: () => Boolean(apiKey()),
  models: () => MODELS,
  defaultModel: () => process.env.GOOGLE_MODEL?.trim() || DEFAULT_MODEL,

  async createCompletion(messages, options = {}) {
    const key = apiKey();
    if (!key) throw new Error("GOOGLE_API_KEY is not configured.");
    const model = options.model ?? geminiProvider.defaultModel();

    const response = await post(`models/${model}:generateContent`, key, {
      contents: toGeminiContents(messages),
      ...(options.system
        ? { systemInstruction: { parts: [{ text: options.system }] } }
        : {}),
      generationConfig: {
        maxOutputTokens: options.maxTokens ?? 2048,
        temperature: options.temperature,
        topP: options.topP,
      },
    });

    const data = (await response.json()) as GeminiResponse;
    return { text: extractText(data), model, usage: extractUsage(data) };
  },

  async streamCompletion(messages, options = {}) {
    const key = apiKey();
    if (!key) throw new Error("GOOGLE_API_KEY is not configured.");
    const model = options.model ?? geminiProvider.defaultModel();
    // Gemini's raw streamGenerateContent returns a slowly-growing JSON
    // array, which can't be parsed incrementally — alt=sse gives one
    // complete JSON object per event instead, which streamWithSse parses.
    return streamWithSse(model, key, messages, options);
  },
};

async function streamWithSse(
  model: string,
  key: string,
  messages: AiMessage[],
  options: { system?: string; maxTokens?: number; temperature?: number; topP?: number }
) {
  let response: Response;
  try {
    response = await fetch(
      `${BASE_URL}/models/${model}:streamGenerateContent?alt=sse&key=${encodeURIComponent(key)}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: toGeminiContents(messages),
          ...(options.system
            ? { systemInstruction: { parts: [{ text: options.system }] } }
            : {}),
          generationConfig: {
            maxOutputTokens: options.maxTokens ?? 2048,
            temperature: options.temperature,
            topP: options.topP,
          },
        }),
      }
    );
  } catch (error) {
    const cause = error instanceof Error ? error.message : String(error);
    throw new AiProviderError(`Could not reach Gemini (${cause}).`, 503, "gemini");
  }

  if (!response.ok || !response.body) {
    const data = await response.json().catch(() => null);
    throw new AiProviderError(
      data?.error?.message ?? `Gemini request failed (${response.status}).`,
      response.status,
      "gemini"
    );
  }

  const encoder = new TextEncoder();
  const decoder = new TextDecoder();
  const reader = response.body.getReader();

  let resolveCompletion!: (value: AiCompletion) => void;
  let rejectCompletion!: (reason: unknown) => void;
  const completion = new Promise<AiCompletion>((resolve, reject) => {
    resolveCompletion = resolve;
    rejectCompletion = reject;
  });

  let fullText = "";
  let usage: AiUsage = { promptTokens: 0, completionTokens: 0 };
  let buffer = "";

  const stream = new ReadableStream<Uint8Array>({
    async pull(controller) {
      try {
        const { done, value } = await reader.read();
        if (done) {
          controller.close();
          resolveCompletion({ text: fullText, model, usage });
          return;
        }

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed.startsWith("data:")) continue;
          const payload = trimmed.slice(5).trim();
          if (!payload) continue;

          let chunk: GeminiResponse;
          try {
            chunk = JSON.parse(payload);
          } catch {
            continue;
          }

          const delta = extractText(chunk);
          if (delta) {
            fullText += delta;
            controller.enqueue(encoder.encode(delta));
          }
          if (chunk.usageMetadata) {
            usage = extractUsage(chunk);
          }
        }
      } catch (error) {
        controller.error(error);
        rejectCompletion(error);
      }
    },
    cancel(reason) {
      void reader.cancel(reason);
      resolveCompletion({ text: fullText, model, usage });
    },
  });

  return { stream, completion, model };
}
