/**
 * Shared types for the multi-provider AI layer. Every provider adapter
 * (NVIDIA, OpenAI, Anthropic, Gemini, DeepSeek, Grok) implements
 * `AiProvider` so the rest of the app — the registry, the /api/ai/complete
 * and /api/ai/compare routes, the settings/comparison UI — can treat them
 * interchangeably.
 */

export type AiProviderId =
  | "nvidia"
  | "openai"
  | "anthropic"
  | "gemini"
  | "deepseek"
  | "grok";

/** A function the model can call. `parameters` is a JSON Schema object. */
export interface AiToolDefinition {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
}

/** A single invocation of a tool, requested by the model. */
export interface AiToolCall {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
}

export interface AiMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string;
  /** Set on an assistant message that requested one or more tool calls. */
  toolCalls?: AiToolCall[];
  /** Set on a "tool" message — the call this result answers. */
  toolCallId?: string;
  /** Set on a "tool" message — which tool produced this result. */
  name?: string;
}

export interface AiUsage {
  promptTokens: number;
  completionTokens: number;
}

export interface AiCompletion {
  text: string;
  model: string;
  usage: AiUsage;
  /** Present when the model's turn ended in a tool call instead of (or alongside) text. */
  toolCalls?: AiToolCall[];
}

export interface AiStreamResult {
  stream: ReadableStream<Uint8Array>;
  completion: Promise<AiCompletion>;
  model: string;
}

export interface AiCompletionOptions {
  model?: string;
  system?: string;
  maxTokens?: number;
  temperature?: number;
  topP?: number;
  /** Ignored by providers where `supportsTools` is false. */
  tools?: AiToolDefinition[];
}

export class AiProviderError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly providerId: AiProviderId
  ) {
    super(message);
    this.name = "AiProviderError";
  }
}

export interface AiModelInfo {
  id: string;
  label: string;
  /** Approximate context window, for display only. */
  contextWindow?: number;
  /** USD per 1M tokens. Omitted where pricing is free/included (e.g. NVIDIA's free tier). */
  pricing?: { inputPer1M: number; outputPer1M: number };
}

export interface AiProvider {
  id: AiProviderId;
  label: string;
  /** True when the required API key/config is present in the environment. */
  isConfigured(): boolean;
  /**
   * True when `createCompletion` honors `options.tools` / returns
   * `AiCompletion.toolCalls`. False for providers where tool calling
   * isn't wired up (their `tools` option is silently ignored) — callers
   * that need tools (the agent runtime) should check this before relying
   * on a tool actually being invoked.
   */
  supportsTools: boolean;
  /** Models this provider exposes, most capable first. */
  models(): AiModelInfo[];
  /** The model used when a call doesn't specify one. */
  defaultModel(): string;
  createCompletion(
    messages: AiMessage[],
    options?: AiCompletionOptions
  ): Promise<AiCompletion>;
  streamCompletion(
    messages: AiMessage[],
    options?: AiCompletionOptions
  ): Promise<AiStreamResult>;
}
