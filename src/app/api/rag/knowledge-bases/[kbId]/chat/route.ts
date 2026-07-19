import { NextResponse } from "next/server";

import { getProvider } from "@/lib/ai/providers/registry";
import { answerFromKnowledgeBase } from "@/lib/rag/chat";
import { loadOwnedKnowledgeBase, requireRagUser } from "@/lib/rag/access";
import { ragChatSchema } from "@/lib/validations/rag";

export const maxDuration = 60;

type RouteParams = { params: Promise<{ kbId: string }> };

/**
 * POST /api/rag/knowledge-bases/[kbId]/chat — ask a question grounded
 * in this knowledge base's documents. See lib/rag/chat.ts for the
 * retrieve-then-answer flow (shared with the workflow "kb_chat" step).
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

  try {
    const result = await answerFromKnowledgeBase({
      supabase: auth.supabase,
      ownerId: auth.userId,
      knowledgeBaseId: kbId,
      question: input.message,
      providerId: input.provider,
      model: input.model,
    });
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Chat failed" },
      { status: 502 }
    );
  }
}
