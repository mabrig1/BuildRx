/**
 * Approximate token counting shared across providers.
 *
 * This is deliberately a heuristic, not a real tokenizer: each provider
 * uses its own tokenizer (tiktoken for OpenAI, SentencePiece-derived
 * vocabularies for others), and bundling all of them just to show an
 * estimate in the UI isn't worth the dependency weight. Actual usage
 * returned by a provider's API (see AiUsage) is always the source of
 * truth for billing/limits — this is only for pre-flight estimates
 * (e.g. "about how much will this cost") before a call is made.
 */

/**
 * ~4 characters per token is the commonly-cited average for English
 * text across GPT/Claude/Gemini-family tokenizers. Good enough for a
 * ballpark estimate; not accurate for code, non-English text, or exact
 * billing.
 */
const CHARS_PER_TOKEN = 4;

export function estimateTokens(text: string): number {
  if (!text) return 0;
  return Math.max(1, Math.ceil(text.length / CHARS_PER_TOKEN));
}

export function estimateMessagesTokens(
  messages: Array<{ content: string }>
): number {
  return messages.reduce((sum, m) => sum + estimateTokens(m.content), 0);
}
