/**
 * Shared reader for OpenAI-compatible SSE completion streams.
 *
 * NVIDIA NIM and OpenRouter both speak the OpenAI wire format, and the
 * parsing here is where two hard-won fixes live — the pump loop and the
 * reasoning capture below. Duplicating it per provider would mean one
 * copy silently missing them, so both providers read their streams
 * through this.
 */

export interface StreamedUsage {
  promptTokens: number;
  completionTokens: number;
}

export interface StreamedCompletion {
  text: string;
  /**
   * Reasoning models stream their scratchpad in a separate field and only
   * then emit `content`. Kept apart from `text` (it is thinking, not an
   * answer) but never discarded: a model cut short mid-thought has
   * produced nothing in `content`, and the work it did do is the only
   * thing standing between the caller and a total failure.
   */
  reasoning: string;
  usage: StreamedUsage;
  model: string;
}

interface StreamChunk {
  choices?: Array<{
    delta?: { content?: string; reasoning_content?: string; reasoning?: string };
  }>;
  usage?: { prompt_tokens?: number; completion_tokens?: number } | null;
}

/**
 * Turns an SSE response body into a byte stream of content deltas plus a
 * `completion` promise carrying the full text, reasoning and usage.
 */
export function readCompletionStream(
  body: ReadableStream<Uint8Array>,
  model: string
): {
  stream: ReadableStream<Uint8Array>;
  completion: Promise<StreamedCompletion>;
} {
  const encoder = new TextEncoder();
  const decoder = new TextDecoder();

  let resolveCompletion!: (value: StreamedCompletion) => void;
  let rejectCompletion!: (reason: unknown) => void;
  const completion = new Promise<StreamedCompletion>((resolve, reject) => {
    resolveCompletion = resolve;
    rejectCompletion = reject;
  });

  const reader = body.getReader();
  let fullText = "";
  let reasoningText = "";
  let usage: StreamedUsage = { promptTokens: 0, completionTokens: 0 };
  let buffer = "";

  const stream = new ReadableStream<Uint8Array>({
    async pull(controller) {
      try {
        /**
         * Pump until something is actually enqueued (or upstream ends).
         *
         * A chunk can legitimately carry no content delta — a
         * reasoning-only chunk, a usage-only chunk, an SSE keep-alive —
         * and returning from `pull` without enqueueing anything stalls
         * the stream: nothing asks for the next chunk, the consumer's
         * read never settles, and the call dies at its timeout having
         * collected nothing at all.
         *
         * That is not a rare edge case. Reasoning models spend most of
         * their chunks — often all of them — on reasoning, which is what
         * made whole generations arrive as "returned nothing".
         */
        for (;;) {
          const { done, value } = await reader.read();
          if (done) {
            controller.close();
            resolveCompletion({
              text: fullText,
              reasoning: reasoningText,
              usage,
              model,
            });
            return;
          }

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";
          let enqueued = false;

          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed.startsWith("data:")) continue;
            const payload = trimmed.slice(5).trim();
            if (payload === "[DONE]") continue;

            let chunk: StreamChunk;
            try {
              chunk = JSON.parse(payload);
            } catch {
              continue; // skip malformed keep-alive/partial lines
            }

            const delta = chunk.choices?.[0]?.delta;
            const content = delta?.content;
            if (content) {
              fullText += content;
              controller.enqueue(encoder.encode(content));
              enqueued = true;
            }
            // Collected but deliberately not streamed: the caller asked
            // for an answer, not a transcript of the model thinking.
            // NVIDIA uses `reasoning_content`; OpenRouter uses
            // `reasoning`. Accept either.
            const reasoning = delta?.reasoning_content ?? delta?.reasoning;
            if (reasoning) reasoningText += reasoning;

            if (chunk.usage) {
              usage = {
                promptTokens: chunk.usage.prompt_tokens ?? 0,
                completionTokens: chunk.usage.completion_tokens ?? 0,
              };
            }
          }

          if (enqueued) return;
        }
      } catch (error) {
        controller.error(error);
        rejectCompletion(error);
      }
    },
    cancel(reason) {
      void reader.cancel(reason);
      resolveCompletion({
        text: fullText,
        reasoning: reasoningText,
        usage,
        model,
      });
    },
  });

  return { stream, completion };
}
