/**
 * Centralized AI provider selection.
 *
 * NVIDIA's Inference API (NIM) is the only provider used by default —
 * every tier of the chain is an NVIDIA model, so a build or a chat reply
 * never depends on a paid Anthropic balance. If one NVIDIA model is
 * unavailable (404 for a retired model id, a 429, a 5xx), the next
 * NVIDIA model is tried instead.
 *
 * Priority: nvidia-primary (GLM, or the caller's role-specialized
 * model) → nvidia-fast (Step) → nvidia-lite (Llama). The tiers are named
 * for their role rather than their model, since the model behind each is
 * env-configurable — the concrete one used is always reported alongside
 * the tier (the `X-Model` header, usage records, build logs).
 *
 * Anthropic Claude is opt-in and OFF unless `ANTHROPIC_ENABLED=true` is
 * set alongside a funded `ANTHROPIC_API_KEY`. Merely having the key in
 * the environment is deliberately not enough: a stale key with no
 * credit used to end every run with Anthropic's "credit balance is too
 * low" 400 instead of a real NVIDIA result.
 *
 * (OpenAI/Gemini/xAI are intentionally not wired in — nothing in this
 * app holds keys for them today; adding untested, unkeyed providers
 * would just be dead code paths.)
 */
import Anthropic from "@anthropic-ai/sdk";

import {
  isNvidiaConfigured,
  nvidiaChatModel,
  nvidiaGlmModel,
  nvidiaLlamaModel,
  streamChatCompletion,
  type NvidiaMessage,
} from "@/lib/ai/nvidia";

export type ProviderName =
  | "nvidia-primary"
  | "nvidia-fast"
  | "nvidia-lite"
  | "anthropic";

/** The NVIDIA tiers, in the order they are attempted. */
const NVIDIA_PROVIDERS = ["nvidia-primary", "nvidia-fast", "nvidia-lite"] as const;

type NvidiaProviderName = (typeof NVIDIA_PROVIDERS)[number];

function isNvidiaProvider(provider: ProviderName): provider is NvidiaProviderName {
  return (NVIDIA_PROVIDERS as readonly string[]).includes(provider);
}

export interface ProviderMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface ProviderUsage {
  promptTokens: number;
  completionTokens: number;
}

export interface CompletionResult {
  text: string;
  provider: ProviderName;
  model: string;
  usage: ProviderUsage;
}

export interface ProviderCallOptions {
  maxTokens?: number;
  temperature?: number;
  /** Budget for a single provider attempt, not the whole fallback chain. */
  timeoutMs?: number;
  /** Only used when Anthropic is explicitly enabled (see module header). */
  anthropicModel?: string;
  /**
   * Overrides the model used for the primary NVIDIA tier — lets callers
   * that need a role-specialized NVIDIA model (e.g. the code-generation
   * agents, which use the Laguna code model, or chat, which uses the
   * fast Step model) keep that specialization while still going through
   * the same fallback chain. The remaining tiers always use their fixed
   * models; they exist as NVIDIA's own safety net, not as extra
   * specialized slots.
   */
  nvidiaModel?: string;
  /**
   * Overrides the model used for the "nvidia-fast" fallback tier — the
   * agent pipeline points this at the general-purpose model (Kimi when
   * configured) so a failed role-specialized call falls back to a
   * capable generalist before dropping to the lite tier.
   */
  nvidiaFallbackModel?: string;
}

const DEFAULT_TIMEOUT_MS = 90_000;
const DEFAULT_ANTHROPIC_MODEL = "claude-opus-4-8";

/**
 * Anthropic is opt-in: the key alone does not enable it. This is what
 * keeps a keyed-but-unfunded account from surfacing billing errors to
 * users instead of an NVIDIA answer.
 */
function isAnthropicEnabled(): boolean {
  const flag = process.env.ANTHROPIC_ENABLED?.trim().toLowerCase();
  const enabled = flag === "true" || flag === "1";
  return enabled && Boolean(process.env.ANTHROPIC_API_KEY?.trim());
}

/** Providers usable right now, in priority order. */
export function availableProviders(): ProviderName[] {
  const providers: ProviderName[] = [];
  if (isNvidiaConfigured()) providers.push(...NVIDIA_PROVIDERS);
  if (isAnthropicEnabled()) providers.push("anthropic");
  return providers;
}

export function isAnyProviderConfigured(): boolean {
  return availableProviders().length > 0;
}

/** The concrete model each NVIDIA tier resolves to for this call. */
function nvidiaModelFor(
  provider: NvidiaProviderName,
  options: ProviderCallOptions
): string {
  switch (provider) {
    case "nvidia-primary":
      return options.nvidiaModel ?? nvidiaGlmModel();
    case "nvidia-fast":
      return options.nvidiaFallbackModel ?? nvidiaChatModel();
    case "nvidia-lite":
      return nvidiaLlamaModel();
  }
}

interface Attempt {
  provider: ProviderName;
  /** Empty for Anthropic — resolved separately from `anthropicModel`. */
  model: string;
}

/**
 * The ordered attempts for one call: every configured provider tier,
 * with duplicate NVIDIA models collapsed (a caller overriding the
 * primary tier with the Step model shouldn't cause the identical
 * request to be retried under a second tier name).
 */
function plannedAttempts(options: ProviderCallOptions): Attempt[] {
  const attempts: Attempt[] = [];
  const seenModels = new Set<string>();

  for (const provider of availableProviders()) {
    if (isNvidiaProvider(provider)) {
      const model = nvidiaModelFor(provider, options);
      if (seenModels.has(model)) continue;
      seenModels.add(model);
      attempts.push({ provider, model });
      continue;
    }
    attempts.push({ provider, model: "" });
  }

  return attempts;
}

/**
 * Smallest slice worth starting an attempt with.
 *
 * Sized for time-to-first-token on a free inference tier, where a large
 * model can take 20s+ just to start streaming. Splitting a step's budget
 * into 8-second slices produced the worst possible outcome in
 * production: three models each given too little time to answer, so all
 * three "failed" and the step fell back to a scaffold — while every one
 * of them was working normally.
 */
const MIN_ATTEMPT_MS = 25_000;

/**
 * The budget for the next attempt.
 *
 * The first tier gets the *whole* remaining budget rather than a share
 * of it. Reserving time for later tiers only pays off when failures are
 * fast (a 404 for a retired model, a 401), and those cost no time at
 * all — they return immediately and leave the budget intact for the
 * next tier. The expensive failure is a slow model, and holding time
 * back from the first attempt is precisely what turns "slow" into
 * "failed".
 */
function attemptBudgetMs(deadlineAt: number): number {
  return Math.floor(deadlineAt - Date.now());
}

/**
 * Whether a failure leaves any point trying another model.
 *
 * A timeout means this endpoint is slower than the budget allows;
 * another model on the same endpoint will be too. Falling back to the
 * caller's scaffold immediately beats burning the rest of the step on a
 * second and third model that cannot answer any faster either.
 */
function isTimeoutFailure(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /timeout|timed out|aborted|returned nothing|ran out of time|no response within/i.test(
    message
  );
}

function noProviderError(): Error {
  return new Error(
    "No AI provider is configured — set NVIDIA_API_KEY (free at https://build.nvidia.com)."
  );
}

/**
 * Model names reach logs and user-facing errors, and a misconfigured
 * deployment can put key material in a model variable — so anything
 * secret-shaped is masked before it is ever written down. Validation
 * upstream should prevent this; masking makes a leak impossible rather
 * than unlikely.
 */
function safeModelName(model: string): string {
  return /^nvapi-|bearer\s/i.test(model) || model.length > 120
    ? "<redacted: not a valid model id>"
    : model;
}

/**
 * Every attempt failed. Names the models actually tried so production
 * logs point at the real cause (bad key vs. retired model id) instead of
 * whichever error happened to be last.
 */
function allFailedError(attempts: Attempt[], lastError: unknown): Error {
  const tried = attempts
    .map((a) => (a.model ? `${a.provider} (${safeModelName(a.model)})` : a.provider))
    .join(", ");
  const detail =
    lastError instanceof Error ? lastError.message : String(lastError ?? "unknown error");
  return new Error(`All AI providers failed. Tried: ${tried}. Last error: ${detail}`);
}

function toNvidiaMessages(messages: ProviderMessage[]): NvidiaMessage[] {
  return messages.map((m) => ({ role: m.role, content: m.content }));
}

/**
 * Runs a completion as a *stream* and keeps whatever arrives before the
 * budget runs out.
 *
 * A non-streaming request holds the connection until the whole
 * generation is finished, so a large answer on a slow endpoint produces
 * nothing at all when the deadline hits — "no response within 54s" even
 * though the model was working the entire time. Streaming turns that
 * same call into partial output: the file blocks that did finish, or a
 * plan object that can be repaired. Partial beats empty every time, and
 * the callers are all built to handle short output (the agents fill the
 * remainder from their scaffolds).
 */
async function collectStreamed(
  messages: ProviderMessage[],
  nvidiaOptions: {
    model: string;
    maxTokens?: number;
    temperature?: number;
    timeoutMs: number;
  }
): Promise<{ text: string; model: string; usage: ProviderUsage; truncated: boolean }> {
  const { stream, completion, model } = await streamChatCompletion(
    toNvidiaMessages(messages),
    nvidiaOptions
  );
  // The completion promise is the streaming API's own bookkeeping; we
  // read the stream directly, so its rejection must be swallowed at the
  // moment it is created. Attaching the handler in two steps
  // (`then(...).catch(...)`) leaves the promise returned by `then`
  // unhandled if `completion` rejects first — which is exactly what
  // happened when a request aborted mid-body, crashing the function
  // with "Unhandled Rejection: TimeoutError" and killing the build.
  let usage: ProviderUsage = { promptTokens: 0, completionTokens: 0 };
  completion.then(
    (done) => {
      usage = done.usage;
    },
    () => {
      /* aborted or errored — the text we already collected still counts */
    }
  );

  const reader = stream.getReader();
  const decoder = new TextDecoder();
  const deadlineAt = Date.now() + nvidiaOptions.timeoutMs;

  let text = "";
  let truncated = false;
  let expiry: ReturnType<typeof setTimeout> | undefined;
  const expired = new Promise<"expired">((resolve) => {
    expiry = setTimeout(() => resolve("expired"), nvidiaOptions.timeoutMs);
  });

  try {
    for (;;) {
      if (Date.now() >= deadlineAt) {
        truncated = true;
        break;
      }
      const next = await Promise.race([reader.read(), expired]);
      if (next === "expired") {
        truncated = true;
        break;
      }
      if (next.done) break;
      text += decoder.decode(next.value, { stream: true });
    }
  } catch (error) {
    // The request's own abort signal covers the body read, so a
    // generation that outruns the budget surfaces here as "aborted due
    // to timeout" rather than through the race above. Either way the
    // bytes already received are still good — only an empty result is a
    // real failure worth passing to the next model.
    truncated = true;
    if (text.length === 0) throw error;
  } finally {
    clearTimeout(expiry);
    void reader.cancel().catch(() => {});
  }

  return { text, model, usage, truncated };
}

/**
 * Caps requested output tokens to each NVIDIA model's realistic
 * completion window — GLM and Step (and the code-model override) handle
 * large generations, but Llama here is a lightweight 1B model that
 * exists purely as NVIDIA's last-resort tier.
 */
function nvidiaMaxTokens(
  provider: NvidiaProviderName,
  requested?: number
): number | undefined {
  if (requested === undefined) return undefined;
  const ceiling = provider === "nvidia-lite" ? 4096 : 16384;
  return Math.min(requested, ceiling);
}

function splitForAnthropic(messages: ProviderMessage[]) {
  const system = messages
    .filter((m) => m.role === "system")
    .map((m) => m.content)
    .join("\n\n");
  const rest = messages
    .filter((m) => m.role !== "system")
    .map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    }));
  return { system: system || undefined, rest };
}

/**
 * Non-streaming completion with fallback — used by the agent build
 * pipeline, where callers just need the final text.
 */
export async function completeText(
  messages: ProviderMessage[],
  options: ProviderCallOptions = {}
): Promise<CompletionResult> {
  const attempts = plannedAttempts(options);
  if (attempts.length === 0) {
    throw noProviderError();
  }

  const deadlineAt = Date.now() + (options.timeoutMs ?? DEFAULT_TIMEOUT_MS);
  let lastError: unknown;
  for (const [index, attempt] of attempts.entries()) {
    const budgetMs = attemptBudgetMs(deadlineAt);
    if (budgetMs < MIN_ATTEMPT_MS && index > 0) {
      lastError ??= new Error("Ran out of time before any model could answer.");
      break;
    }
    try {
      return await completeWithProvider(attempt, messages, {
        ...options,
        timeoutMs: budgetMs,
      });
    } catch (error) {
      console.error(
        `AI provider ${attempt.provider}${attempt.model ? ` (${safeModelName(attempt.model)})` : ""} failed:`,
        error instanceof Error ? error.message : error
      );
      lastError = error;
      // A slow endpoint won't get faster for the next model on it.
      if (isTimeoutFailure(error)) break;
    }
  }
  throw allFailedError(attempts, lastError);
}

async function completeWithProvider(
  attempt: Attempt,
  messages: ProviderMessage[],
  options: ProviderCallOptions
): Promise<CompletionResult> {
  const { provider } = attempt;
  if (isNvidiaProvider(provider)) {
    const result = await collectStreamed(messages, {
      model: attempt.model,
      maxTokens: nvidiaMaxTokens(provider, options.maxTokens),
      temperature: options.temperature,
      timeoutMs: options.timeoutMs ?? DEFAULT_TIMEOUT_MS,
    });
    // Nothing at all means this model never started answering — that is
    // a real failure and the next tier should get a turn. Anything else,
    // even cut short, is usable output.
    if (result.text.trim().length === 0) {
      throw new Error(
        `${safeModelName(attempt.model)} returned nothing within ${Math.round((options.timeoutMs ?? DEFAULT_TIMEOUT_MS) / 1000)}s.`
      );
    }
    if (result.truncated) {
      console.warn(
        `AI provider ${provider} (${safeModelName(result.model)}) hit its time budget — keeping ${result.text.length} chars of partial output.`
      );
    }
    return { text: result.text, provider, model: result.model, usage: result.usage };
  }

  // Anthropic
  const { system, rest } = splitForAnthropic(messages);
  const client = new Anthropic();
  const model = options.anthropicModel ?? DEFAULT_ANTHROPIC_MODEL;
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const stream = client.messages.stream({
    model,
    max_tokens: options.maxTokens ?? 8192,
    thinking: { type: "adaptive" },
    ...(system ? { system } : {}),
    messages: rest,
  });

  let timedOut = false;
  const deadline = setTimeout(() => {
    timedOut = true;
    stream.abort();
  }, timeoutMs);

  try {
    const message = await stream.finalMessage();
    const text = message.content
      .filter((block) => block.type === "text")
      .map((block) => block.text)
      .join("");
    return {
      text,
      provider: "anthropic",
      model,
      usage: {
        promptTokens: message.usage.input_tokens,
        completionTokens: message.usage.output_tokens,
      },
    };
  } catch (error) {
    if (timedOut) {
      throw new Error(`Anthropic call exceeded its ${Math.round(timeoutMs / 1000)}s time budget.`);
    }
    throw error;
  } finally {
    clearTimeout(deadline);
  }
}

export interface StreamResult {
  stream: ReadableStream<Uint8Array>;
  provider: ProviderName;
  model: string;
  completion: Promise<CompletionResult>;
}

/**
 * Streaming completion with fallback — used by the chat endpoint.
 *
 * Fallback only happens if a provider fails before any bytes would
 * reach the client (its request/connect attempt errors out) — once a
 * provider's stream has actually started, we're committed to it, same
 * as any real streaming API: you can't un-send bytes already flushed
 * to the response.
 */
export async function streamText(
  messages: ProviderMessage[],
  options: ProviderCallOptions = {}
): Promise<StreamResult> {
  const attempts = plannedAttempts(options);
  if (attempts.length === 0) {
    throw noProviderError();
  }

  const deadlineAt = Date.now() + (options.timeoutMs ?? DEFAULT_TIMEOUT_MS);
  let lastError: unknown;
  for (const [index, attempt] of attempts.entries()) {
    const budgetMs = attemptBudgetMs(deadlineAt);
    if (budgetMs < MIN_ATTEMPT_MS && index > 0) {
      lastError ??= new Error("Ran out of time before any model could answer.");
      break;
    }
    try {
      const { provider } = attempt;
      if (isNvidiaProvider(provider)) {
        const { stream, completion, model: resolvedModel } = await streamChatCompletion(
          toNvidiaMessages(messages),
          {
            model: attempt.model,
            maxTokens: nvidiaMaxTokens(provider, options.maxTokens),
            temperature: options.temperature,
            // Streaming keeps the connection open for the whole
            // generation, so this bounds the reply itself, not just the
            // connect: the client's own watchdog must never fire first.
            timeoutMs: deadlineAt - Date.now(),
          }
        );
        return {
          stream,
          provider,
          model: resolvedModel,
          completion: completion.then((result) => ({
            text: result.text,
            provider,
            model: result.model,
            usage: result.usage,
          })),
        };
      }
      return streamAnthropic(messages, { ...options, timeoutMs: budgetMs });
    } catch (error) {
      console.error(
        `AI provider ${attempt.provider}${attempt.model ? ` (${safeModelName(attempt.model)})` : ""} failed:`,
        error instanceof Error ? error.message : error
      );
      lastError = error;
      // A slow endpoint won't get faster for the next model on it.
      if (isTimeoutFailure(error)) break;
    }
  }
  throw allFailedError(attempts, lastError);
}

function streamAnthropic(
  messages: ProviderMessage[],
  options: ProviderCallOptions
): StreamResult {
  const { system, rest } = splitForAnthropic(messages);
  const client = new Anthropic();
  const model = options.anthropicModel ?? DEFAULT_ANTHROPIC_MODEL;
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  let resolveCompletion!: (value: CompletionResult) => void;
  let rejectCompletion!: (reason: unknown) => void;
  const completion = new Promise<CompletionResult>((resolve, reject) => {
    resolveCompletion = resolve;
    rejectCompletion = reject;
  });

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let fullText = "";
      let timedOut = false;
      const messageStream = client.messages.stream({
        model,
        max_tokens: options.maxTokens ?? 8192,
        thinking: { type: "adaptive" },
        ...(system ? { system } : {}),
        messages: rest,
      });
      const deadline = setTimeout(() => {
        timedOut = true;
        messageStream.abort();
      }, timeoutMs);

      try {
        for await (const event of messageStream) {
          if (
            event.type === "content_block_delta" &&
            event.delta.type === "text_delta"
          ) {
            fullText += event.delta.text;
            controller.enqueue(encoder.encode(event.delta.text));
          }
        }
        const final = await messageStream.finalMessage();
        const result: CompletionResult = {
          text: fullText,
          provider: "anthropic",
          model,
          usage: {
            promptTokens: final.usage.input_tokens,
            completionTokens: final.usage.output_tokens,
          },
        };
        resolveCompletion(result);
        controller.close();
      } catch (error) {
        const err = timedOut
          ? new Error(`Anthropic call exceeded its ${Math.round(timeoutMs / 1000)}s time budget.`)
          : error instanceof Error
            ? error
            : new Error(String(error));
        if (fullText.length === 0) {
          controller.enqueue(encoder.encode(err.message));
        }
        rejectCompletion(err);
        controller.close();
      } finally {
        clearTimeout(deadline);
      }
    },
  });

  return { stream, provider: "anthropic", model, completion };
}
