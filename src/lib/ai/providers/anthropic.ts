/**
 * Anthropic provider adapter. Reuses the same @anthropic-ai/sdk usage
 * already proven out in /api/chat — this just wraps it behind the
 * shared AiProvider interface so it can sit in the same registry as
 * every other provider.
 */

import Anthropic from "@anthropic-ai/sdk";

import { AiProviderError } from "@/lib/ai/providers/types";
import type {
  AiCompletion,
  AiMessage,
  AiProvider,
  AiToolCall,
} from "@/lib/ai/providers/types";

const DEFAULT_MODEL = "claude-sonnet-5";

// Pricing is approximate (USD / 1M tokens) — verify against Anthropic's
// current published rates before relying on it for real invoicing.
const MODELS = [
  { id: "claude-opus-4-8", label: "Claude Opus 4.8", contextWindow: 200_000, pricing: { inputPer1M: 15, outputPer1M: 75 } },
  { id: "claude-sonnet-5", label: "Claude Sonnet 5", contextWindow: 200_000, pricing: { inputPer1M: 3, outputPer1M: 15 } },
  { id: "claude-haiku-4-5-20251001", label: "Claude Haiku 4.5", contextWindow: 200_000, pricing: { inputPer1M: 0.8, outputPer1M: 4 } },
];

function apiKey() {
  return process.env.ANTHROPIC_API_KEY?.trim() || undefined;
}

/**
 * Converts our provider-agnostic AiMessage[] into Anthropic's format.
 * Anthropic has no "tool" role — a tool result is a `user` message
 * containing a `tool_result` content block, and an assistant message
 * that called a tool carries `tool_use` blocks alongside any text.
 */
function toAnthropicMessages(messages: AiMessage[]): Anthropic.MessageParam[] {
  return messages
    .filter((m) => m.role !== "system")
    .map((m): Anthropic.MessageParam => {
      if (m.role === "tool") {
        return {
          role: "user",
          content: [
            {
              type: "tool_result",
              tool_use_id: m.toolCallId ?? "",
              content: m.content,
            },
          ],
        };
      }
      if (m.role === "assistant" && m.toolCalls?.length) {
        return {
          role: "assistant",
          content: [
            ...(m.content ? [{ type: "text" as const, text: m.content }] : []),
            ...m.toolCalls.map((tc) => ({
              type: "tool_use" as const,
              id: tc.id,
              name: tc.name,
              input: tc.arguments,
            })),
          ],
        };
      }
      return { role: m.role as "user" | "assistant", content: m.content };
    });
}

function extractToolCalls(content: Anthropic.ContentBlock[]): AiToolCall[] | undefined {
  const calls = content
    .filter((block): block is Anthropic.ToolUseBlock => block.type === "tool_use")
    .map((block) => ({
      id: block.id,
      name: block.name,
      arguments: (block.input ?? {}) as Record<string, unknown>,
    }));
  return calls.length > 0 ? calls : undefined;
}

export const anthropicProvider: AiProvider = {
  id: "anthropic",
  label: "Anthropic",
  isConfigured: () => Boolean(apiKey()),
  supportsTools: true,
  models: () => MODELS,
  defaultModel: () => process.env.ANTHROPIC_MODEL?.trim() || DEFAULT_MODEL,

  async createCompletion(messages, options = {}) {
    const key = apiKey();
    if (!key) throw new Error("ANTHROPIC_API_KEY is not configured.");
    const client = new Anthropic({ apiKey: key });
    const model = options.model ?? anthropicProvider.defaultModel();

    try {
      const response = await client.messages.create({
        model,
        max_tokens: options.maxTokens ?? 2048,
        temperature: options.temperature,
        top_p: options.topP,
        system: options.system,
        messages: toAnthropicMessages(messages),
        ...(options.tools?.length
          ? {
              tools: options.tools.map((tool) => ({
                name: tool.name,
                description: tool.description,
                input_schema: tool.parameters as Anthropic.Tool["input_schema"],
              })),
            }
          : {}),
      });

      const text = response.content
        .filter((block): block is Anthropic.TextBlock => block.type === "text")
        .map((block) => block.text)
        .join("");

      return {
        text,
        model: response.model,
        usage: {
          promptTokens: response.usage.input_tokens,
          completionTokens: response.usage.output_tokens,
        },
        toolCalls: extractToolCalls(response.content),
      };
    } catch (error) {
      throw mapAnthropicError(error);
    }
  },

  async streamCompletion(messages, options = {}) {
    const key = apiKey();
    if (!key) throw new Error("ANTHROPIC_API_KEY is not configured.");
    const client = new Anthropic({ apiKey: key });
    const model = options.model ?? anthropicProvider.defaultModel();

    const encoder = new TextEncoder();
    let resolveCompletion!: (value: AiCompletion) => void;
    let rejectCompletion!: (reason: unknown) => void;
    const completion = new Promise<AiCompletion>((resolve, reject) => {
      resolveCompletion = resolve;
      rejectCompletion = reject;
    });

    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        let fullText = "";
        try {
          const messageStream = client.messages.stream({
            model,
            max_tokens: options.maxTokens ?? 2048,
            temperature: options.temperature,
            top_p: options.topP,
            system: options.system,
            messages: toAnthropicMessages(messages),
          });

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
          controller.close();
          resolveCompletion({
            text: fullText,
            model: final.model,
            usage: {
              promptTokens: final.usage.input_tokens,
              completionTokens: final.usage.output_tokens,
            },
          });
        } catch (error) {
          const mapped = mapAnthropicError(error);
          controller.error(mapped);
          rejectCompletion(mapped);
        }
      },
    });

    return { stream, completion, model };
  },
};

function mapAnthropicError(error: unknown): AiProviderError {
  if (error instanceof Anthropic.APIError) {
    return new AiProviderError(
      `Anthropic request failed (${error.status}): ${error.message}`,
      error.status ?? 502,
      "anthropic"
    );
  }
  const message = error instanceof Error ? error.message : "Unknown error";
  return new AiProviderError(`Anthropic request failed: ${message}`, 500, "anthropic");
}
