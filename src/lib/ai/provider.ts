/**
 * Centralized AI provider selection.
 *
 * Detects which providers are actually configured (by API key presence)
 * and tries them in priority order, falling through to the next one on
 * failure. Never throws unless every configured provider has failed —
 * and if none are configured at all, callers are expected to fall back
 * to their own demo/mock response (see chat/route.ts), not treat that
 * as a crash.
 *
 * Priority: NVIDIA GLM → NVIDIA Llama → Anthropic Claude.
 * (OpenAI/Gemini/xAI are intentionally not wired in — nothing in this
 * app holds keys for them today; adding untested, unkeyed providers
 * would just be dead code paths.)
 */
import Anthropic from "@anthropic-ai/sdk";

import {
  createChatCompletion,
  isNvidiaConfigured,
  nvidiaGlmModel,
  nvidiaLlamaModel,
  streamChatCompletion,
  type NvidiaMessage,
} from "@/lib/ai/nvidia";

export type ProviderName = "nvidia-glm" | "nvidia-llama" | "anthropic";

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
  anthropicModel?: string;
  /**
   * Overrides the model used for the "nvidia-glm" tier — lets callers
   * that need a role-specialized NVIDIA model (e.g. the code-generation
   * agents, which use the Laguna code model) keep that specialization
   * while still going through the same priority chain. The "nvidia-llama"
   * tier always uses the lightweight Llama model regardless of role —
   * it exists purely as NVIDIA's own fallback before leaving the
   * provider entirely, not a second specialized slot.
   */
  nvidiaModel?: string;
}

const DEFAULT_TIMEOUT_MS = 90_000;
const DEFAULT_ANTHROPIC_MODEL = "claude-opus-4-8";

function isAnthropicConfigured(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

/** Providers with a key present, in priority order. */
export function availableProviders(): ProviderName[] {
  const providers: ProviderName[] = [];
  if (isNvidiaConfigured()) providers.push("nvidia-glm", "nvidia-llama");
  if (isAnthropicConfigured()) providers.push("anthropic");
  return providers;
}

export function isAnyProviderConfigured(): boolean {
  return isNvidiaConfigured() || isAnthropicConfigured();
}

function toNvidiaMessages(messages: ProviderMessage[]): NvidiaMessage[] {
  return messages.map((m) => ({ role: m.role, content: m.content }));
}

/**
 * Caps requested output tokens to each NVIDIA model's realistic
 * completion window — GLM (and its code-model override) handles large
 * generations, but Llama here is a lightweight 1B model that exists
 * purely as NVIDIA's own fallback tier, not a second full-size slot.
 */
function nvidiaMaxTokens(provider: "nvidia-glm" | "nvidia-llama", requested?: number): number | undefined {
  if (requested === undefined) return undefined;
  const ceiling = provider === "nvidia-glm" ? 16384 : 4096;
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
  const providers = availableProviders();
  if (providers.length === 0) {
    throw new Error(
      "No AI provider is configured — set NVIDIA_API_KEY or ANTHROPIC_API_KEY."
    );
  }

  let lastError: unknown;
  for (const provider of providers) {
    try {
      return await completeWithProvider(provider, messages, options);
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError instanceof Error
    ? lastError
    : new Error("All configured AI providers failed.");
}

async function completeWithProvider(
  provider: ProviderName,
  messages: ProviderMessage[],
  options: ProviderCallOptions
): Promise<CompletionResult> {
  if (provider === "nvidia-glm" || provider === "nvidia-llama") {
    const model =
      provider === "nvidia-glm" ? options.nvidiaModel ?? nvidiaGlmModel() : nvidiaLlamaModel();
    const result = await createChatCompletion(toNvidiaMessages(messages), {
      model,
      maxTokens: nvidiaMaxTokens(provider, options.maxTokens),
      temperature: options.temperature,
    });
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
  const providers = availableProviders();
  if (providers.length === 0) {
    throw new Error(
      "No AI provider is configured — set NVIDIA_API_KEY or ANTHROPIC_API_KEY."
    );
  }

  let lastError: unknown;
  for (const provider of providers) {
    try {
      if (provider === "nvidia-glm" || provider === "nvidia-llama") {
        const model =
          provider === "nvidia-glm" ? options.nvidiaModel ?? nvidiaGlmModel() : nvidiaLlamaModel();
        const { stream, completion, model: resolvedModel } = await streamChatCompletion(
          toNvidiaMessages(messages),
          {
            model,
            maxTokens: nvidiaMaxTokens(provider, options.maxTokens),
            temperature: options.temperature,
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
      return streamAnthropic(messages, options);
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError instanceof Error
    ? lastError
    : new Error("All configured AI providers failed.");
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
