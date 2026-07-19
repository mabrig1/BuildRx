/**
 * Generic engine for any provider that speaks the OpenAI chat-completions
 * wire format (OpenAI itself, DeepSeek, xAI/Grok — and NVIDIA's NIM
 * endpoints, though NVIDIA keeps its own standalone module). One
 * implementation of retries/streaming/error-mapping shared by every
 * OpenAI-wire-compatible adapter instead of copy-pasted per provider.
 */

import { AiProviderError } from "@/lib/ai/providers/types";
import type {
  AiCompletion,
  AiCompletionOptions,
  AiMessage,
  AiProviderId,
  AiStreamResult,
  AiUsage,
} from "@/lib/ai/providers/types";

const MAX_RETRIES = 2;

export interface OpenAiCompatibleConfig {
  providerId: AiProviderId;
  baseUrl: string;
  apiKey: string;
  defaultModel: string;
}

function errorForStatus(
  providerId: AiProviderId,
  status: number,
  detail: string
): AiProviderError {
  switch (status) {
    case 401:
    case 403:
      return new AiProviderError(
        `${providerId} authentication failed — check the API key.`,
        status,
        providerId
      );
    case 404:
      return new AiProviderError(`Model not found: ${detail}`, status, providerId);
    case 429:
      return new AiProviderError(
        `${providerId} rate limit exceeded — please retry shortly.`,
        status,
        providerId
      );
    default:
      return new AiProviderError(
        status >= 500
          ? `${providerId} is temporarily unavailable.`
          : `${providerId} request failed: ${detail}`,
        status,
        providerId
      );
  }
}

async function parseErrorDetail(response: Response): Promise<string> {
  try {
    const data = await response.json();
    return data?.error?.message ?? data?.detail ?? response.statusText;
  } catch {
    return response.statusText;
  }
}

function buildBody(
  messages: AiMessage[],
  options: AiCompletionOptions,
  config: OpenAiCompatibleConfig,
  stream: boolean
) {
  const fullMessages: AiMessage[] = options.system
    ? [{ role: "system", content: options.system }, ...messages]
    : messages;

  return {
    model: options.model ?? config.defaultModel,
    messages: fullMessages,
    max_tokens: options.maxTokens ?? 2048,
    temperature: options.temperature ?? 0.6,
    ...(options.topP !== undefined ? { top_p: options.topP } : {}),
    stream,
    ...(stream ? { stream_options: { include_usage: true } } : {}),
  };
}

async function request(
  config: OpenAiCompatibleConfig,
  body: Record<string, unknown>
): Promise<Response> {
  let lastError: AiProviderError | null = null;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    if (attempt > 0) {
      await new Promise((resolve) =>
        setTimeout(resolve, 500 * 2 ** (attempt - 1))
      );
    }

    let response: Response;
    try {
      response = await fetch(`${config.baseUrl.replace(/\/$/, "")}/chat/completions`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${config.apiKey}`,
          "Content-Type": "application/json",
          Accept: body.stream ? "text/event-stream" : "application/json",
        },
        body: JSON.stringify(body),
      });
    } catch (error) {
      const cause = error instanceof Error ? error.message : String(error);
      lastError = new AiProviderError(
        `Could not reach ${config.providerId} (${cause}).`,
        503,
        config.providerId
      );
      continue;
    }

    if (response.ok) return response;

    const detail = await parseErrorDetail(response);
    const error = errorForStatus(config.providerId, response.status, detail);
    if (response.status !== 429 && response.status < 500) throw error;
    lastError = error;
  }

  throw lastError ?? new AiProviderError("Request failed.", 500, config.providerId);
}

export async function createOpenAiCompatibleCompletion(
  config: OpenAiCompatibleConfig,
  messages: AiMessage[],
  options: AiCompletionOptions = {}
): Promise<AiCompletion> {
  const body = buildBody(messages, options, config, false);
  const response = await request(config, body);
  const data = await response.json();

  return {
    text: data.choices?.[0]?.message?.content ?? "",
    model: data.model ?? (body.model as string),
    usage: {
      promptTokens: data.usage?.prompt_tokens ?? 0,
      completionTokens: data.usage?.completion_tokens ?? 0,
    },
  };
}

export async function streamOpenAiCompatibleCompletion(
  config: OpenAiCompatibleConfig,
  messages: AiMessage[],
  options: AiCompletionOptions = {}
): Promise<AiStreamResult> {
  const body = buildBody(messages, options, config, true);
  const response = await request(config, body);
  if (!response.body) {
    throw new AiProviderError("Empty stream response.", 502, config.providerId);
  }

  const model = body.model as string;
  const encoder = new TextEncoder();
  const decoder = new TextDecoder();

  let resolveCompletion!: (value: AiCompletion) => void;
  let rejectCompletion!: (reason: unknown) => void;
  const completion = new Promise<AiCompletion>((resolve, reject) => {
    resolveCompletion = resolve;
    rejectCompletion = reject;
  });

  const reader = response.body.getReader();
  let fullText = "";
  let usage: AiUsage = { promptTokens: 0, completionTokens: 0 };
  let buffer = "";

  const stream = new ReadableStream<Uint8Array>({
    async pull(controller) {
      try {
        const { done, value } = await reader.read();
        if (done) {
          controller.close();
          resolveCompletion({ text: fullText, usage, model });
          return;
        }

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed.startsWith("data:")) continue;
          const payload = trimmed.slice(5).trim();
          if (payload === "[DONE]") continue;

          let chunk: {
            choices?: Array<{ delta?: { content?: string } }>;
            usage?: { prompt_tokens?: number; completion_tokens?: number } | null;
          };
          try {
            chunk = JSON.parse(payload);
          } catch {
            continue;
          }

          const delta = chunk.choices?.[0]?.delta?.content;
          if (delta) {
            fullText += delta;
            controller.enqueue(encoder.encode(delta));
          }
          if (chunk.usage) {
            usage = {
              promptTokens: chunk.usage.prompt_tokens ?? 0,
              completionTokens: chunk.usage.completion_tokens ?? 0,
            };
          }
        }
      } catch (error) {
        controller.error(error);
        rejectCompletion(error);
      }
    },
    cancel(reason) {
      void reader.cancel(reason);
      resolveCompletion({ text: fullText, usage, model });
    },
  });

  return { stream, completion, model };
}
