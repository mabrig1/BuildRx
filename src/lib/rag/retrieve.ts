/**
 * Semantic retrieval over one knowledge base — embeds the query and
 * calls the match_knowledge_chunks Postgres function (cosine similarity
 * over the hnsw index), then joins in each chunk's source document name
 * for citations.
 */

import { embedQuery } from "@/lib/ai/embeddings";
import type { CitationChunk } from "@/lib/rag/prompt";
import { createClient } from "@/lib/supabase/server";

type SupabaseClientType = Awaited<ReturnType<typeof createClient>>;

const DEFAULT_MATCH_COUNT = 6;
/** Below this cosine similarity, a chunk isn't worth citing as relevant context. */
const MIN_SIMILARITY = 0.3;

export async function retrieveRelevantChunks({
  supabase,
  ownerId,
  knowledgeBaseId,
  query,
  matchCount = DEFAULT_MATCH_COUNT,
}: {
  supabase: SupabaseClientType;
  ownerId: string;
  knowledgeBaseId: string;
  query: string;
  matchCount?: number;
}): Promise<CitationChunk[]> {
  const queryEmbedding = await embedQuery(query);

  const { data, error } = await supabase.rpc("match_knowledge_chunks", {
    query_embedding: queryEmbedding,
    target_kb_id: knowledgeBaseId,
    match_owner_id: ownerId,
    match_count: matchCount,
  });
  if (error) {
    throw new Error(`Knowledge base search failed: ${error.message}`);
  }

  const matches = (data ?? []).filter((match) => match.similarity >= MIN_SIMILARITY);
  if (matches.length === 0) return [];

  const documentIds = [...new Set(matches.map((match) => match.document_id))];
  const { data: documents } = await supabase
    .from("knowledge_documents")
    .select("id, name")
    .in("id", documentIds);
  const nameById = new Map((documents ?? []).map((doc) => [doc.id, doc.name]));

  return matches.map((match) => ({
    documentId: match.document_id,
    documentName: nameById.get(match.document_id) ?? "Untitled document",
    chunkIndex: match.chunk_index,
    content: match.content,
    similarity: match.similarity,
  }));
}
