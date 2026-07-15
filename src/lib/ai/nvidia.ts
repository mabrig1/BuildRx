/**
 * NVIDIA Inference API (NIM) service layer.
 *
 * Talks to the OpenAI-compatible chat completions endpoint at
 * https://integrate.api.nvidia.com/v1. Server-only — never import from
 * client components.
 */

const DEFAULT_BASE_URL = "https://integrate.api.nvidia.com/v1";
const DEFAULT_TEXT_MODEL = "meta/llama-3.3-70b-instruct";
const DEFAULT_CODE_MODEL = "qwen/qwen2.5-coder-32b-instruct";

const MAX_RETRIES = 2;

export interface NvidiaMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface NvidiaChatOptions {
  model?: string;
  maxTokens?: number;
  temperature?: number;
}

export interface NvidiaUsage {
  promptTokens: number;
  completionTokens: number;
}

export interface NvidiaCompletion {
  text: string;
  usage: NvidiaUsage;
  model: string;
}

export class NvidiaApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly retryable: boolean
  ) {
    super(message);
    this.name = "NvidiaApiError";
  }
}

export function isNvidiaConfigured() {
  return Boolean(process.env.NVIDIA_API_KEY);
}

export function nvidiaTextModel() {
  return process.env.NVIDIA_TEXT_MODEL ?? DEFAULT_TEXT_MODEL;
}

export function nvidiaCodeModel() {
  return process.env.NVIDIA_CODE_MODEL ?? DEFAULT_CODE_MODEL;
}

function baseUrl() {
  return (process.env.NVIDIA_API_BASE_URL ?? DEFAULT_BASE_URL).replace(
    /\/$/,
    ""
  );
}

function errorForStatus(status: number, detail: string): NvidiaApiError {
  switch (status) {
    case 401:
    case 403:
      return new NvidiaApiError(
        "NVIDIA API authentication failed — check NVIDIA_API_KEY.",
        status,
        false
      );
    case 404:
      return new NvidiaApiError(
        `NVIDIA model not found: ${detail}`,
        status,
        false
      );
    case 429:
      return new NvidiaApiError(
        "NVIDIA API rate limit exceeded — please retry shortly.",
        status,
        true
      );
    default:
      return new NvidiaApiError(
        status >= 500
          ? "NVIDIA API is temporarily unavailable."
          : `NVIDIA API request failed: ${detail}`,
        status,
        status >= 500
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

/**
 * POST to /chat/completions with retries on retryable failures
 * (429 and 5xx, honoring Retry-After; network errors included).
 */
async function requestChatCompletion(
  body: Record<string, unknown>
): Promise<Response> {
  const apiKey = process.env.NVIDIA_API_KEY;
  if (!apiKey) {
    throw new NvidiaApiError("NVIDIA_API_KEY is not configured.", 503, false);
  }

  let lastError: NvidiaApiError | null = null;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    if (attempt > 0) {
      const backoffMs = 500 * 2 ** (attempt - 1);
      await new Promise((resolve) => setTimeout(resolve, backoffMs));
    }

    let response: Response;
    try {
      response = await fetch(`${baseUrl()}/chat/completions`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
          Accept: body.stream ? "text/event-stream" : "application/json",
        },
        body: JSON.stringify(body),
      });
    } catch {
      lastError = new NvidiaApiError(
        "Could not reach the NVIDIA API.",
        503,
        true
      );
      continue;
    }

    if (response.ok) {
      return response;
    }

    const error = errorForStatus(
      response.status,
      await parseErrorDetail(response)
    );
    if (!error.retryable) {
      throw error;
    }

    const retryAfter = Number(response.headers.get("retry-after"));
    if (retryAfter > 0 && retryAfter <= 10) {
      await new Promise((resolve) => setTimeout(resolve, retryAfter * 1000));
    }
    lastError = error;
  }

  throw lastError ?? new NvidiaApiError("NVIDIA API request failed.", 500, true);
}

function buildBody(
  messages: NvidiaMessage[],
  options: NvidiaChatOptions,
  stream: boolean
) {
  return {
    model: options.model ?? nvidiaTextModel(),
    messages,
    max_tokens: options.maxTokens ?? 2048,
    temperature: options.temperature ?? 0.6,
    stream,
    ...(stream ? { stream_options: { include_usage: true } } : {}),
  };
}

/** Non-streaming chat completion. */
export async function createChatCompletion(
  messages: NvidiaMessage[],
  options: NvidiaChatOptions = {}
): Promise<NvidiaCompletion> {
  const body = buildBody(messages, options, false);
  const response = await requestChatCompletion(body);
  const data = await response.json();

  return {
    text: data.choices?.[0]?.message?.content ?? "",
    usage: {
      promptTokens: data.usage?.prompt_tokens ?? 0,
      completionTokens: data.usage?.completion_tokens ?? 0,
    },
    model: data.model ?? (body.model as string),
  };
}

/**
 * Streaming chat completion.
 *
 * Returns a byte stream of text deltas for the client plus a `completion`
 * promise that resolves with the full text and token usage once the
 * upstream stream ends (for persistence/metering).
 */
export async function streamChatCompletion(
  messages: NvidiaMessage[],
  options: NvidiaChatOptions = {}
): Promise<{
  stream: ReadableStream<Uint8Array>;
  completion: Promise<NvidiaCompletion>;
  model: string;
}> {
  const body = buildBody(messages, options, true);
  const response = await requestChatCompletion(body);
  if (!response.body) {
    throw new NvidiaApiError("NVIDIA API returned an empty stream.", 502, true);
  }

  const model = body.model as string;
  const encoder = new TextEncoder();
  const decoder = new TextDecoder();

  let resolveCompletion!: (value: NvidiaCompletion) => void;
  let rejectCompletion!: (reason: unknown) => void;
  const completion = new Promise<NvidiaCompletion>((resolve, reject) => {
    resolveCompletion = resolve;
    rejectCompletion = reject;
  });

  const reader = response.body.getReader();
  let fullText = "";
  let usage: NvidiaUsage = { promptTokens: 0, completionTokens: 0 };
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
            usage?: {
              prompt_tokens?: number;
              completion_tokens?: number;
            } | null;
          };
          try {
            chunk = JSON.parse(payload);
          } catch {
            continue; // skip malformed keep-alive/partial lines
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
