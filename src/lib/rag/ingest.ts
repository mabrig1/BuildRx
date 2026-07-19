/**
 * Turns extracted document text into searchable knowledge_chunks rows:
 * split into overlapping chunks (chunk.ts), embed each in batches
 * (NVIDIA embeddings), insert. Text extraction itself reuses
 * src/lib/documents/extract.ts from Phase 3 rather than duplicating
 * PDF/DOCX/XLSX/image parsing.
 */

import { embedTexts } from "@/lib/ai/embeddings";
import { chunkText } from "@/lib/rag/chunk";
import { createClient } from "@/lib/supabase/server";

type SupabaseClientType = Awaited<ReturnType<typeof createClient>>;

/** Kept comfortably under the NVIDIA embeddings API's per-request item limit. */
const EMBED_BATCH_SIZE = 16;

export interface IngestResult {
  chunkCount: number;
}

/**
 * Chunks and embeds `text`, storing rows against `documentId`. Throws
 * on embedding failure — the caller is expected to mark the document
 * `failed` and record the error message.
 */
export async function ingestDocumentText({
  supabase,
  ownerId,
  knowledgeBaseId,
  documentId,
  text,
}: {
  supabase: SupabaseClientType;
  ownerId: string;
  knowledgeBaseId: string;
  documentId: string;
  text: string;
}): Promise<IngestResult> {
  const chunks = chunkText(text);
  if (chunks.length === 0) {
    return { chunkCount: 0 };
  }

  const embeddings: number[][] = [];
  for (let i = 0; i < chunks.length; i += EMBED_BATCH_SIZE) {
    const batch = chunks.slice(i, i + EMBED_BATCH_SIZE);
    const batchEmbeddings = await embedTexts(batch, "passage");
    embeddings.push(...batchEmbeddings);
  }

  const rows = chunks.map((content, index) => ({
    document_id: documentId,
    knowledge_base_id: knowledgeBaseId,
    owner_id: ownerId,
    chunk_index: index,
    content,
    embedding: embeddings[index],
  }));

  const { error } = await supabase.from("knowledge_chunks").insert(rows);
  if (error) {
    throw new Error(`Failed to save knowledge chunks: ${error.message}`);
  }

  return { chunkCount: chunks.length };
}
