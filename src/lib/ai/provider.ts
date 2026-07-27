/**
 * Centralized AI provider selection.
 *
 * Priority: OpenRouter (when OPENROUTER_API_KEY is set) → NVIDIA NIM →
 * Anthropic (opt-in only). Each tier falls through to the next on
 * failure, so no single provider outage stops a build.
 *
 * OpenRouter leads because the free NVIDIA tier, in practice, did not
 * return anything inside a build step's budget — every generated app
 * came back as a built-in scaffold. NVIDIA remains in the chain as a
 * no-cost fallback rather than being removed.
 *
 * The tiers are named for their role rather than their model, since the
 * model behind each is env-configurable — the concrete one used is
 * always reported alongside the tier (the `X-Model` header, usage
 * records, build logs).
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
import {
  isOpenRouterConfigured,
  openrouterModel,
  openrouterStrongModel,
  streamChatCompletion as streamOpenRouter,
} from "@/lib/ai/openrouter";

export type ProviderName =
  | "openrouter-primary"
  | "openrouter-fast"
  | "nvidia-primary"
  | "nvidia-fast"
  | "nvidia-lite"
  | "anthropic";

/**
 * The OpenRouter tiers, attempted before NVIDIA when configured.
 *
 * Order is deliberate: OpenRouter is a paid, multi-vendor endpoint that
 * answers reliably, whereas the free NVIDIA tier repeatedly failed to
 * return anything inside a build step's budget — which is what left
 * every generated app as a built-in scaffold. NVIDIA stays in the chain
 * behind it as a no-cost fallback.
 */
const OPENROUTER_PROVIDERS = ["openrouter-primary", "openrouter-fast"] as const;

/** The NVIDIA tiers, in the order they are attempted. */
const NVIDIA_PROVIDERS = ["nvidia-primary", "nvidia-fast", "nvidia-lite"] as const;

type NvidiaProviderName = (typeof NVIDIA_PROVIDERS)[number];
type OpenRouterProviderName = (typeof OPENROUTER_PROVIDERS)[number];

function isNvidiaProvider(provider: ProviderName): provider is NvidiaProviderName {
  return (NVIDIA_PROVIDERS as readonly string[]).includes(provider);
}

function isOpenRouterProvider(
  provider: ProviderName
): provider is OpenRouterProviderName {
  return (OPENROUTER_PROVIDERS as readonly string[]).includes(provider);
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
  /**
   * Overrides the model used for the primary OpenRouter tier. Callers
   * that know the shape of the work (planning and code generation want
   * the stronger model; review and diagnostics do not) set this; anything
   * unset uses the configured defaults.
   */
  openrouterModel?: string;
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
  if (isOpenRouterConfigured()) providers.push(...OPENROUTER_PROVIDERS);
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

/** The concrete model each OpenRouter tier resolves to for this call. */
function openrouterModelFor(
  provider: OpenRouterProviderName,
  options: ProviderCallOptions
): string {
  return provider === "openrouter-primary"
    ? (options.openrouterModel ?? openrouterStrongModel())
    : openrouterModel();
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
    if (isOpenRouterProvider(provider)) {
      const model = openrouterModelFor(provider, options);
      if (seenModels.has(model)) continue;
      seenModels.add(model);
      attempts.push({ provider, model });
      continue;
    }
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
 * The first tier used to get the *whole* remaining budget, on the theory
 * that failures are fast (a 404, a 401) and so cost the later tiers
 * nothing. The expensive failure turned out to be the common one: a
 * model that never answers consumed the entire step, every later tier
 * was skipped for having under MIN_ATTEMPT_MS left, and the build fell
 * back to a scaffold having genuinely tried exactly one model.
 *
 * Halving rather than dividing evenly keeps the first tier — the best
 * model for the job — with the largest single share, while guaranteeing
 * the next one an actual turn.
 */
function attemptBudgetMs(deadlineAt: number, attemptsLeft: number): number {
  const remaining = Math.floor(deadlineAt - Date.now());
  if (attemptsLeft <= 1) return remaining;
  // Never hand out more than is actually left: an inflated budget makes
  // the caller's "not enough time to start" guard unreachable, so a
  // spent step would still open an attempt it cannot finish.
  return Math.min(remaining, Math.max(MIN_ATTEMPT_MS, Math.floor(remaining / 2)));
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
/**
 * Reports the models that were *actually called*, each with its own
 * error — not the models that were merely planned.
 *
 * Listing the plan made the log actively misleading: a first tier that
 * consumed the whole budget left the others unreachable, yet the message
 * still read "Tried: …, nvidia-lite (llama-3.2-1b)", which invited the
 * conclusion that even a 1B model could not answer. It had never been
 * asked.
 */
function allFailedError(tried: string[], lastError: unknown): Error {
  const detail =
    lastError instanceof Error ? lastError.message : String(lastError ?? "unknown error");
  if (tried.length === 0) {
    return new Error(
      `No model could be called before the step's time ran out. Last error: ${detail}`
    );
  }
  return new Error(`All AI providers failed. Tried ${tried.length}: ${tried.join(" | ")}`);
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
  callOptions: {
    model: string;
    maxTokens?: number;
    temperature?: number;
    timeoutMs: number;
    /** Which upstream to stream from. Both speak the OpenAI wire format. */
    via?: "nvidia" | "openrouter";
  }
): Promise<{ text: string; model: string; usage: ProviderUsage; truncated: boolean }> {
  const { via, ...upstreamOptions } = callOptions;
  const { stream, completion, model } =
    via === "openrouter"
      ? await streamOpenRouter(messages, upstreamOptions)
      : await streamChatCompletion(toNvidiaMessages(messages), upstreamOptions);
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
  const deadlineAt = Date.now() + callOptions.timeoutMs;

  let text = "";
  let truncated = false;
  let expiry: ReturnType<typeof setTimeout> | undefined;
  const expired = new Promise<"expired">((resolve) => {
    expiry = setTimeout(() => resolve("expired"), callOptions.timeoutMs);
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

  /**
   * Last resort: the model thought but never answered.
   *
   * Every default model in this chain is a reasoning model, and those
   * stream their scratchpad in `reasoning_content` before emitting a
   * single `content` delta. A model that spends its whole budget
   * thinking therefore produced an empty `text` here — which was
   * reported upstream as "returned nothing", failed every tier of the
   * chain, and left the pipeline to fall back to built-in scaffolds.
   * That is a generated app silently becoming a template.
   *
   * The thinking is not an answer, but it usually contains one: the plan
   * JSON, or the ===FILE:=== blocks the agent asked for. The callers
   * already cope — extractJson skips <think> blocks and hunts for the
   * first JSON object, parseFileBlocks scans for file blocks anywhere.
   * Handing back the reasoning gives them something to work with;
   * handing back "" guarantees a scaffold.
   */
  if (text.trim().length === 0) {
    const finished = await completion.catch(() => null);
    const reasoning = finished?.reasoning?.trim() ?? "";
    if (reasoning) {
      console.warn(
        `AI provider (${model}) emitted only reasoning (${reasoning.length} chars) and no content — using the reasoning.`
      );
      text = reasoning;
      truncated = true;
    }
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
  const tried: string[] = [];
  for (const [index, attempt] of attempts.entries()) {
    const budgetMs = attemptBudgetMs(deadlineAt, attempts.length - index);
    // No time at all stops even the first attempt: opening a request
    // against a spent budget only produces a misleading timeout.
    if (budgetMs <= 0 || (budgetMs < MIN_ATTEMPT_MS && index > 0)) {
      lastError ??= new Error("Ran out of time before any model could answer.");
      break;
    }
    const label = attempt.model
      ? `${attempt.provider} (${safeModelName(attempt.model)})`
      : attempt.provider;
    try {
      return await completeWithProvider(attempt, messages, {
        ...options,
        timeoutMs: budgetMs,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`AI provider ${label} failed:`, message);
      tried.push(`${label}: ${message}`);
      lastError = error;
      /**
       * Deliberately no early exit on a timeout.
       *
       * This used to break out of the chain, reasoning that a slow
       * endpoint would be slow for every model on it. A single build
       * disproved that: qwen2.5-coder-32b answered for the UI and
       * database steps while gpt-oss-20b timed out for the planner —
       * same endpoint, same key, same minute. Slowness is a property of
       * the model, so the next tier is worth its turn.
       */
    }
  }
  throw allFailedError(tried, lastError);
}

async function completeWithProvider(
  attempt: Attempt,
  messages: ProviderMessage[],
  options: ProviderCallOptions
): Promise<CompletionResult> {
  const { provider } = attempt;
  if (isOpenRouterProvider(provider)) {
    const result = await collectStreamed(messages, {
      model: attempt.model,
      maxTokens: options.maxTokens,
      temperature: options.temperature,
      timeoutMs: options.timeoutMs ?? DEFAULT_TIMEOUT_MS,
      via: "openrouter",
    });
    if (result.text.trim().length === 0) {
      throw new Error(
        `${safeModelName(attempt.model)} returned nothing within ${Math.round((options.timeoutMs ?? DEFAULT_TIMEOUT_MS) / 1000)}s.`
      );
    }
    return { text: result.text, provider, model: result.model, usage: result.usage };
  }
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
  const tried: string[] = [];
  for (const [index, attempt] of attempts.entries()) {
    const budgetMs = attemptBudgetMs(deadlineAt, attempts.length - index);
    // No time at all stops even the first attempt: opening a request
    // against a spent budget only produces a misleading timeout.
    if (budgetMs <= 0 || (budgetMs < MIN_ATTEMPT_MS && index > 0)) {
      lastError ??= new Error("Ran out of time before any model could answer.");
      break;
    }
    const label = attempt.model
      ? `${attempt.provider} (${safeModelName(attempt.model)})`
      : attempt.provider;
    try {
      const { provider } = attempt;
      if (isOpenRouterProvider(provider)) {
        const {
          stream,
          completion,
          model: resolvedModel,
        } = await streamOpenRouter(messages, {
          model: attempt.model,
          maxTokens: options.maxTokens,
          temperature: options.temperature,
          timeoutMs: deadlineAt - Date.now(),
        });
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
      const message = error instanceof Error ? error.message : String(error);
      console.error(`AI provider ${label} failed:`, message);
      tried.push(`${label}: ${message}`);
      lastError = error;
      // No early exit on a timeout — see completeText: slowness is a
      // property of the model, not of the endpoint.
    }
  }
  throw allFailedError(tried, lastError);
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
