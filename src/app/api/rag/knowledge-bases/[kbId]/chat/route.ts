import { NextResponse } from "next/server";

import { getProvider } from "@/lib/ai/providers/registry";
import { recordAiUsage } from "@/lib/ai/usage";
import { buildRagPrompt, NO_CONTEXT_ANSWER, summarizeCitations } from "@/lib/rag/prompt";
import { retrieveRelevantChunks } from "@/lib/rag/retrieve";
import { loadOwnedKnowledgeBase, requireRagUser } from "@/lib/rag/access";
import { ragChatSchema } from "@/lib/validations/rag";

export const maxDuration = 60;

type RouteParams = { params: Promise<{ kbId: string }> };

/**
 * POST /api/rag/knowledge-bases/[kbId]/chat — ask a question grounded
 * in this knowledge base's documents. Retrieves the most relevant
 * chunks by embedding similarity, then asks the model to answer using
 * only that context. Returns a fixed, no-model-call answer when
 * nothing relevant is found rather than letting the model guess.
 */
export async function POST(request: Request, { params }: RouteParams) {
  const auth = await requireRagUser();
  if (!auth.ok) return auth.response;
  const { kbId } = await params;

  const knowledgeBase = await loadOwnedKnowledgeBase(auth.supabase, auth.userId, kbId);
  if (!knowledgeBase) {
    return NextResponse.json({ error: "Knowledge base not found" }, { status: 404 });
  }

  const body = await request.json().catch(() => null);
  const parsed = ragChatSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid request" },
      { status: 400 }
    );
  }
  const input = parsed.data;

  const provider = getProvider(input.provider);
  if (!provider.isConfigured()) {
    return NextResponse.json(
      { error: `${provider.label} isn't configured on this deployment.` },
      { status: 503 }
    );
  }

  const startedAt = Date.now();

  let chunks;
  try {
    chunks = await retrieveRelevantChunks({
      supabase: auth.supabase,
      ownerId: auth.userId,
      knowledgeBaseId: kbId,
      query: input.message,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Search failed" },
      { status: 502 }
    );
  }

  if (chunks.length === 0) {
    return NextResponse.json({
      answer: NO_CONTEXT_ANSWER,
      citations: [],
      model: null,
    });
  }

  const { system, prompt } = buildRagPrompt(input.message, chunks);

  try {
    const result = await provider.createCompletion([{ role: "user", content: prompt }], {
      model: input.model,
      system,
      maxTokens: 1200,
      temperature: 0.3,
    });

    await recordAiUsage({
      userId: auth.userId,
      provider: input.provider,
      model: result.model,
      status: "completed",
      promptTokens: result.usage?.promptTokens ?? 0,
      completionTokens: result.usage?.completionTokens ?? 0,
      durationMs: Date.now() - startedAt,
      action: "ai_message",
    });

    return NextResponse.json({
      answer: result.text,
      citations: summarizeCitations(chunks),
      model: result.model,
    });
  } catch (error) {
    await recordAiUsage({
      userId: auth.userId,
      provider: input.provider,
      model: input.model ?? provider.defaultModel(),
      status: "failed",
      promptTokens: 0,
      completionTokens: 0,
      durationMs: Date.now() - startedAt,
      error: error instanceof Error ? error.message : "Unknown error",
      action: "ai_message",
    });
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Chat failed" },
      { status: 502 }
    );
  }
}
