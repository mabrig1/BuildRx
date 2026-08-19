/**
 * OpenRouter service layer.
 *
 * OpenRouter fronts many vendors behind one OpenAI-compatible endpoint,
 * which makes it the reliable tier of the provider chain: the free
 * NVIDIA tier repeatedly failed to answer inside a build step's budget,
 * leaving every generated app as a built-in scaffold. Server-only —
 * never import from client components.
 *
 * Configure with OPENROUTER_API_KEY. The key is read from the
 * environment at call time and never logged, echoed, or returned by any
 * route.
 */
import { readCompletionStream, type StreamedCompletion } from "@/lib/ai/sse";

const DEFAULT_BASE_URL = "https://openrouter.ai/api/v1";

/**
 * Defaults chosen for the two things this pipeline needs: an answer that
 * actually arrives, and one good enough to plan and write an app from.
 * Both are overridable per deployment.
 */
const DEFAULT_MODEL = "openai/gpt-4o-mini";
const DEFAULT_STRONG_MODEL = "openai/gpt-4o";

const REQUEST_TIMEOUT_MS = 120_000;

export interface OpenRouterMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface OpenRouterChatOptions {
  model?: string;
  maxTokens?: number;
  temperature?: number;
  /** Budget for the whole call — connect and generation. */
  timeoutMs?: number;
}

export class OpenRouterApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly retryable: boolean
  ) {
    super(message);
    this.name = "OpenRouterApiError";
  }
}

function cleanEnv(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

export function openrouterApiKey(): string | undefined {
  return cleanEnv(process.env.OPENROUTER_API_KEY);
}

export function isOpenRouterConfigured(): boolean {
  return Boolean(openrouterApiKey());
}

export function openrouterBaseUrl(): string {
  return (cleanEnv(process.env.OPENROUTER_BASE_URL) ?? DEFAULT_BASE_URL).replace(
    /\/$/,
    ""
  );
}

/** Everyday model — chat, review, diagnostics. */
export function openrouterModel(): string {
  return cleanEnv(process.env.OPENROUTER_MODEL) ?? DEFAULT_MODEL;
}

/** Stronger model for planning and writing application code. */
export function openrouterStrongModel(): string {
  return cleanEnv(process.env.OPENROUTER_MODEL_STRONG) ?? DEFAULT_STRONG_MODEL;
}

/**
 * OpenRouter attributes traffic with these; both are optional and
 * neither is secret. Sent only when the app's public URL is known.
 */
function attributionHeaders(): Record<string, string> {
  const site =
    cleanEnv(process.env.NEXT_PUBLIC_APP_URL) ??
    (cleanEnv(process.env.VERCEL_URL)
      ? `https://${cleanEnv(process.env.VERCEL_URL)}`
      : undefined);
  return {
    ...(site ? { "HTTP-Referer": site } : {}),
    "X-Title": cleanEnv(process.env.OPENROUTER_APP_NAME) ?? "BuildRx",
  };
}

function errorForStatus(status: number, detail: string): OpenRouterApiError {
  switch (status) {
    case 401:
    case 403:
      return new OpenRouterApiError(
        "OpenRouter authentication failed — check OPENROUTER_API_KEY.",
        status,
        false
      );
    case 402:
      return new OpenRouterApiError(
        "OpenRouter credit balance is exhausted — top up the account or lower the configured model.",
        status,
        false
      );
    case 404:
      return new OpenRouterApiError(
        `OpenRouter model not found: ${detail}`,
        status,
        false
      );
    case 429:
      return new OpenRouterApiError(
        "OpenRouter rate limit exceeded — please retry shortly.",
        status,
        true
      );
    default:
      return new OpenRouterApiError(
        status >= 500
          ? "OpenRouter is temporarily unavailable."
          : `OpenRouter request failed: ${detail}`,
        status,
        status >= 500
      );
  }
}

async function parseErrorDetail(response: Response): Promise<string> {
  try {
    const data = await response.json();
    return data?.error?.message ?? data?.message ?? response.statusText;
  } catch {
    return response.statusText;
  }
}

function buildBody(
  messages: OpenRouterMessage[],
  options: OpenRouterChatOptions,
  stream: boolean
) {
  return {
    model: options.model ?? openrouterModel(),
    messages,
    max_tokens: options.maxTokens ?? 2048,
    temperature: options.temperature ?? 0.6,
    stream,
    ...(stream ? { stream_options: { include_usage: true } } : {}),
  };
}

async function requestChatCompletion(
  body: Record<string, unknown>,
  timeoutMs?: number
): Promise<Response> {
  const apiKey = openrouterApiKey();
  if (!apiKey) {
    throw new OpenRouterApiError(
      "OPENROUTER_API_KEY is not configured.",
      503,
      false
    );
  }

  const budgetMs = Math.floor(Math.min(REQUEST_TIMEOUT_MS, timeoutMs ?? REQUEST_TIMEOUT_MS));
  if (budgetMs <= 0) {
    throw new OpenRouterApiError(
      "OpenRouter call ran out of time before it could be sent.",
      504,
      false
    );
  }

  const response = await fetch(`${openrouterBaseUrl()}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      ...attributionHeaders(),
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(budgetMs),
  });

  if (!response.ok) {
    throw errorForStatus(response.status, await parseErrorDetail(response));
  }
  return response;
}

/** Streaming chat completion through OpenRouter. */
export async function streamChatCompletion(
  messages: OpenRouterMessage[],
  options: OpenRouterChatOptions = {}
): Promise<{
  stream: ReadableStream<Uint8Array>;
  completion: Promise<StreamedCompletion>;
  model: string;
}> {
  const body = buildBody(messages, options, true);
  const response = await requestChatCompletion(body, options.timeoutMs);
  if (!response.body) {
    throw new OpenRouterApiError(
      "OpenRouter returned an empty stream.",
      502,
      true
    );
  }

  const model = body.model as string;
  const { stream, completion } = readCompletionStream(response.body, model);
  return { stream, completion, model };
}

/**
 * Every model id this key can actually call, straight from OpenRouter's
 * catalog.
 *
 * This is what makes the role ladders safe to write from documentation:
 * an id that is retired, renamed, or simply not offered is filtered out
 * before it is ever requested, rather than 404ing mid-build. Ids only —
 * no key material is returned or logged.
 */
export async function listAvailableModels(): Promise<string[]> {
  try {
    const apiKey = openrouterApiKey();
    const response = await fetch(`${openrouterBaseUrl()}/models`, {
      headers: apiKey ? { Authorization: `Bearer ${apiKey}` } : {},
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) return [];
    const data = await response.json();
    const models: unknown = data?.data ?? data?.models;
    if (!Array.isArray(models)) return [];
    return models
      .map((model: { id?: unknown }) =>
        typeof model?.id === "string" ? model.id : null
      )
      .filter((id): id is string => Boolean(id))
      .sort();
  } catch {
    return [];
  }
}

/** Non-streaming completion — used by the connectivity check. */
export async function createChatCompletion(
  messages: OpenRouterMessage[],
  options: OpenRouterChatOptions = {}
): Promise<StreamedCompletion> {
  const body = buildBody(messages, options, false);
  const response = await requestChatCompletion(body, options.timeoutMs);
  const data = await response.json();

  return {
    text: data.choices?.[0]?.message?.content ?? "",
    reasoning: data.choices?.[0]?.message?.reasoning ?? "",
    usage: {
      promptTokens: data.usage?.prompt_tokens ?? 0,
      completionTokens: data.usage?.completion_tokens ?? 0,
    },
    model: data.model ?? (body.model as string),
  };
}
