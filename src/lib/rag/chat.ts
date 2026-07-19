/**
 * Shared RAG chat flow: retrieve relevant chunks, ask the model to
 * answer from them, meter usage. Used by both the Knowledge Base chat
 * route and the workflow "kb_chat" step, so the retrieval/grounding
 * behavior can't drift between the two.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

import { getProvider } from "@/lib/ai/providers/registry";
import type { AiProviderId } from "@/lib/ai/providers/types";
import { recordAiUsage } from "@/lib/ai/usage";
import { buildRagPrompt, NO_CONTEXT_ANSWER, summarizeCitations, type CitationSummary } from "@/lib/rag/prompt";
import { retrieveRelevantChunks } from "@/lib/rag/retrieve";
import type { Database } from "@/types/database";

export interface RagChatAnswer {
  answer: string;
  citations: CitationSummary[];
  model: string | null;
}

export async function answerFromKnowledgeBase({
  supabase,
  ownerId,
  knowledgeBaseId,
  question,
  providerId,
  model,
}: {
  supabase: SupabaseClient<Database>;
  ownerId: string;
  knowledgeBaseId: string;
  question: string;
  providerId: AiProviderId;
  model?: string;
}): Promise<RagChatAnswer> {
  const provider = getProvider(providerId);
  if (!provider.isConfigured()) {
    throw new Error(`${provider.label} isn't configured on this deployment.`);
  }

  const chunks = await retrieveRelevantChunks({ supabase, ownerId, knowledgeBaseId, query: question });
  if (chunks.length === 0) {
    return { answer: NO_CONTEXT_ANSWER, citations: [], model: null };
  }

  const { system, prompt } = buildRagPrompt(question, chunks);
  const startedAt = Date.now();

  try {
    const result = await provider.createCompletion([{ role: "user", content: prompt }], {
      model,
      system,
      maxTokens: 1200,
      temperature: 0.3,
    });

    await recordAiUsage({
      userId: ownerId,
      provider: providerId,
      model: result.model,
      status: "completed",
      promptTokens: result.usage.promptTokens,
      completionTokens: result.usage.completionTokens,
      durationMs: Date.now() - startedAt,
      action: "ai_message",
    });

    return { answer: result.text, citations: summarizeCitations(chunks), model: result.model };
  } catch (error) {
    await recordAiUsage({
      userId: ownerId,
      provider: providerId,
      model: model ?? provider.defaultModel(),
      status: "failed",
      promptTokens: 0,
      completionTokens: 0,
      durationMs: Date.now() - startedAt,
      error: error instanceof Error ? error.message : "Unknown error",
      action: "ai_message",
    });
    throw error;
  }
}
