/**
 * AI operations over an already-extracted document: summarize, find
 * tables, answer a question, generate a report. All reuse the
 * multi-provider registry from the AI platform (any configured
 * provider works) rather than being tied to one.
 */

import { getProvider } from "@/lib/ai/providers/registry";
import type { AiProviderId } from "@/lib/ai/providers/types";

/** Documents can be long; cap what's sent to the model per call. */
const MAX_CONTEXT_CHARS = 12_000;

function truncate(text: string): string {
  return text.length > MAX_CONTEXT_CHARS
    ? `${text.slice(0, MAX_CONTEXT_CHARS)}\n\n[...truncated for length]`
    : text;
}

async function runDocumentPrompt({
  providerId,
  model,
  system,
  prompt,
  maxTokens,
  temperature,
}: {
  providerId: AiProviderId;
  model?: string;
  system: string;
  prompt: string;
  maxTokens: number;
  temperature: number;
}): Promise<{ text: string; model: string }> {
  const provider = getProvider(providerId);
  if (!provider.isConfigured()) {
    throw new Error(`${provider.label} isn't configured on this deployment.`);
  }
  const result = await provider.createCompletion([{ role: "user", content: prompt }], {
    model,
    system,
    maxTokens,
    temperature,
  });
  return { text: result.text.trim(), model: result.model };
}

export async function summarizeDocumentText({
  providerId,
  model,
  text,
}: {
  providerId: AiProviderId;
  model?: string;
  text: string;
}) {
  return runDocumentPrompt({
    providerId,
    model,
    system:
      "You are a precise document summarization assistant. Be concise and factual — never invent details not present in the document.",
    prompt: `Summarize the following document in a few clear paragraphs, highlighting the key points:\n\n${truncate(text)}`,
    maxTokens: 800,
    temperature: 0.3,
  });
}

export async function extractTablesFromText({
  providerId,
  model,
  text,
}: {
  providerId: AiProviderId;
  model?: string;
  text: string;
}) {
  return runDocumentPrompt({
    providerId,
    model,
    system:
      "You find and format tabular data as clean markdown tables. If the document has no tabular data, say so explicitly instead of inventing a table.",
    prompt: `Find any tabular data in the following document and format each as a markdown table:\n\n${truncate(text)}`,
    maxTokens: 2000,
    temperature: 0.1,
  });
}

export async function askDocumentQuestion({
  providerId,
  model,
  text,
  question,
}: {
  providerId: AiProviderId;
  model?: string;
  text: string;
  question: string;
}) {
  return runDocumentPrompt({
    providerId,
    model,
    system:
      "Answer the question using only the document provided. If the answer isn't in the document, say so clearly instead of guessing.",
    prompt: `Document:\n${truncate(text)}\n\nQuestion: ${question}`,
    maxTokens: 800,
    temperature: 0.2,
  });
}

export async function generateDocumentReport({
  providerId,
  model,
  text,
  documentName,
}: {
  providerId: AiProviderId;
  model?: string;
  text: string;
  documentName: string;
}) {
  return runDocumentPrompt({
    providerId,
    model,
    system:
      "You write clear, structured business reports in markdown, grounded strictly in the source document.",
    prompt:
      `Generate a structured report from the document "${documentName}". Include an executive ` +
      `summary, key findings as bullet points, and any notable data reformatted as markdown ` +
      `tables where useful:\n\n${truncate(text)}`,
    maxTokens: 3000,
    temperature: 0.4,
  });
}
