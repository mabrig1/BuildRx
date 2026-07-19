/**
 * Builds the RAG chat prompt from retrieved chunks — pure and
 * unit-testable independent of the embedding/retrieval network calls.
 */

export interface CitationChunk {
  documentId: string;
  documentName: string;
  chunkIndex: number;
  content: string;
  similarity: number;
}

export interface RagPromptSpec {
  system: string;
  prompt: string;
}

/** The friendly, fixed answer used when nothing relevant was found — no model call needed. */
export const NO_CONTEXT_ANSWER =
  "I couldn't find anything relevant to that in this knowledge base's documents. Try rephrasing, or upload a document that covers this topic.";

export function buildRagPrompt(query: string, chunks: CitationChunk[]): RagPromptSpec {
  const context = chunks
    .map((chunk, i) => `[${i + 1}] (from "${chunk.documentName}")\n${chunk.content}`)
    .join("\n\n---\n\n");

  return {
    system:
      "You are a helpful assistant answering questions using ONLY the context provided below, " +
      "drawn from the user's own uploaded documents. If the context doesn't contain the answer, " +
      "say so plainly instead of guessing or using outside knowledge. Cite sources inline with " +
      "[n] matching the numbered context blocks.",
    prompt: `Context:\n${context}\n\nQuestion: ${query}\n\nAnswer using only the context above, with inline [n] citations.`,
  };
}

export interface CitationSummary {
  documentId: string;
  documentName: string;
}

/** De-duplicated, order-preserving list of the documents a set of retrieved chunks came from. */
export function summarizeCitations(chunks: CitationChunk[]): CitationSummary[] {
  const seen = new Set<string>();
  const summaries: CitationSummary[] = [];
  for (const chunk of chunks) {
    if (seen.has(chunk.documentId)) continue;
    seen.add(chunk.documentId);
    summaries.push({ documentId: chunk.documentId, documentName: chunk.documentName });
  }
  return summaries;
}
