/**
 * NVIDIA Inference API (NIM) service layer.
 *
 * Talks to the OpenAI-compatible chat completions endpoint at
 * https://integrate.api.nvidia.com/v1. Server-only — never import from
 * client components.
 */

const DEFAULT_BASE_URL = "https://integrate.api.nvidia.com/v1";
const DEFAULT_TEXT_MODEL = "z-ai/glm-5.2";
const DEFAULT_CODE_MODEL = "poolside/laguna-xs-2.1";
const DEFAULT_CHAT_MODEL = "stepfun-ai/step-3.7-flash";
const DEFAULT_GLM_MODEL = "z-ai/glm-5.2";
const DEFAULT_LLAMA_MODEL = "meta/llama-3.2-1b-instruct";

const MAX_RETRIES = 2;
/**
 * Per-attempt network timeout — a stuck TCP connection must not hang
 * forever. This same signal also governs streaming responses (the fetch
 * API ties one AbortSignal to the whole request including body reads),
 * so it's sized generously to not cut off a legitimately long-running
 * generation; callers layer their own tighter, context-aware deadlines
 * on top (see chat/route.ts and lib/agents/llm.ts) — this is strictly a
 * "never hang forever" backstop, not the primary timeout control.
 */
const REQUEST_TIMEOUT_MS = 120_000;

export interface NvidiaMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface NvidiaChatOptions {
  model?: string;
  maxTokens?: number;
  temperature?: number;
  topP?: number;
  seed?: number;
  /**
   * Budget for the *whole* call — connect, generation, and any retries.
   * Without it a slow generation runs to REQUEST_TIMEOUT_MS and then
   * retries, so one call could occupy several minutes of a caller that
   * only had seconds to spare. Callers that share a deadline (the agent
   * pipeline, chat) must always pass this.
   */
  timeoutMs?: number;
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

export interface NvidiaModelInfo {
  id: string;
  label: string;
  kind: "text" | "code";
  description: string;
}

/**
 * Models available through the NVIDIA Inference API integration.
 * Any of these can be requested per-call via the `model` field on
 * /api/ai/generate and /api/ai/code.
 */
export const NVIDIA_MODELS: NvidiaModelInfo[] = [
  {
    id: "z-ai/glm-5.2",
    label: "GLM 5.2",
    kind: "text",
    description: "Reasoning model — default for text generation",
  },
  {
    id: "stepfun-ai/step-3.7-flash",
    label: "Step 3.7 Flash",
    kind: "text",
    description: "Fast reasoning model — default for interactive chat",
  },
  {
    id: "poolside/laguna-xs-2.1",
    label: "Laguna XS 2.1",
    kind: "code",
    description: "Code-specialized model — default for code generation",
  },
];

/**
 * Env values pasted into dashboards often carry stray whitespace or
 * newlines; a newline in the key makes the Authorization header invalid
 * and every request fail. Trim everything (empty → undefined).
 */
function cleanEnv(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

export function nvidiaApiKey(): string | undefined {
  return cleanEnv(process.env.NVIDIA_API_KEY);
}

export function isNvidiaConfigured() {
  return Boolean(nvidiaApiKey());
}

export function nvidiaTextModel() {
  return cleanEnv(process.env.NVIDIA_TEXT_MODEL) ?? DEFAULT_TEXT_MODEL;
}

export function nvidiaCodeModel() {
  return cleanEnv(process.env.NVIDIA_CODE_MODEL) ?? DEFAULT_CODE_MODEL;
}

/** Fast model for interactive chat (low latency beats depth there). */
export function nvidiaChatModel() {
  return cleanEnv(process.env.NVIDIA_CHAT_MODEL) ?? DEFAULT_CHAT_MODEL;
}

/** GLM — the primary reasoning model for the provider fallback chain. */
export function nvidiaGlmModel() {
  return cleanEnv(process.env.NVIDIA_GLM_MODEL) ?? DEFAULT_GLM_MODEL;
}

/** Llama — the lightweight second-tier NVIDIA model, tried before leaving NVIDIA entirely. */
export function nvidiaLlamaModel() {
  return cleanEnv(process.env.NVIDIA_LLAMA_MODEL) ?? DEFAULT_LLAMA_MODEL;
}

/** Effective API base URL (env override or the NIM default). */
export function nvidiaBaseUrl() {
  return (
    cleanEnv(process.env.NVIDIA_API_BASE_URL) ??
    cleanEnv(process.env.NVIDIA_BASE_URL) ??
    DEFAULT_BASE_URL
  ).replace(/\/$/, "");
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
 *
 * `timeoutMs` bounds the whole thing — every attempt is capped at the
 * time still left, and no further attempt is started once the budget is
 * gone. This is what keeps one slow generation from overrunning a
 * caller's deadline (a six-step pipeline sharing a single serverless
 * function's duration has no time to lend to a call that ignores it).
 */
async function requestChatCompletion(
  body: Record<string, unknown>,
  timeoutMs?: number
): Promise<Response> {
  const apiKey = nvidiaApiKey();
  if (!apiKey) {
    throw new NvidiaApiError("NVIDIA_API_KEY is not configured.", 503, false);
  }

  const deadlineAt = Date.now() + (timeoutMs ?? REQUEST_TIMEOUT_MS);
  /**
   * Time left, capped by the per-request backstop. Floored to a whole
   * millisecond: AbortSignal.timeout() throws RangeError on a fractional
   * delay, and budgets divided across pipeline steps are fractional
   * nearly every time — which would fail the call before it was sent.
   */
  const attemptTimeoutMs = () =>
    Math.floor(Math.min(REQUEST_TIMEOUT_MS, deadlineAt - Date.now()));

  let lastError: NvidiaApiError | null = null;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    if (attempt > 0) {
      const backoffMs = 500 * 2 ** (attempt - 1);
      if (deadlineAt - Date.now() <= backoffMs) break;
      await new Promise((resolve) => setTimeout(resolve, backoffMs));
    }

    const budgetMs = attemptTimeoutMs();
    if (budgetMs <= 0) {
      throw (
        lastError ??
        new NvidiaApiError(
          `NVIDIA API call ran out of time (${Math.round((timeoutMs ?? REQUEST_TIMEOUT_MS) / 1000)}s budget).`,
          504,
          false
        )
      );
    }

    let response: Response;
    try {
      response = await fetch(`${nvidiaBaseUrl()}/chat/completions`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
          Accept: body.stream ? "text/event-stream" : "application/json",
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(budgetMs),
      });
    } catch (error) {
      // Surface the real network-level cause (DNS, TLS, timeout, invalid
      // header, …) — "fetch failed" alone is undiagnosable in prod logs.
      const isTimeout = error instanceof Error && error.name === "TimeoutError";
      const cause = isTimeout
        ? `no response within ${Math.round(budgetMs / 1000)}s`
        : error instanceof Error
          ? error.cause instanceof Error
            ? `${error.message}: ${error.cause.message}`
            : error.message
          : String(error);
      console.error(`NVIDIA API fetch failed (attempt ${attempt + 1}):`, cause);
      lastError = new NvidiaApiError(
        `Could not reach the NVIDIA API (${cause}).`,
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
    if (retryAfter > 0 && retryAfter * 1000 <= Math.min(10_000, deadlineAt - Date.now())) {
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
    ...(options.topP !== undefined ? { top_p: options.topP } : {}),
    ...(options.seed !== undefined ? { seed: options.seed } : {}),
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
  const response = await requestChatCompletion(body, options.timeoutMs);
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
  const response = await requestChatCompletion(body, options.timeoutMs);
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
