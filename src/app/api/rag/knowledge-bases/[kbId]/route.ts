import { NextResponse } from "next/server";

import { loadOwnedKnowledgeBase, requireRagUser } from "@/lib/rag/access";
import { updateKnowledgeBaseSchema } from "@/lib/validations/rag";

type RouteParams = { params: Promise<{ kbId: string }> };

/**
 * GET /api/rag/knowledge-bases/[kbId] — the KB plus its document count.
 *
 * PATCH — update name/description. DELETE — remove it (cascades to its
 * documents and chunks).
 */
export async function GET(_request: Request, { params }: RouteParams) {
  const auth = await requireRagUser();
  if (!auth.ok) return auth.response;
  const { kbId } = await params;

  const knowledgeBase = await loadOwnedKnowledgeBase(auth.supabase, auth.userId, kbId);
  if (!knowledgeBase) {
    return NextResponse.json({ error: "Knowledge base not found" }, { status: 404 });
  }

  const { count } = await auth.supabase
    .from("knowledge_documents")
    .select("*", { count: "exact", head: true })
    .eq("knowledge_base_id", kbId);

  return NextResponse.json({ knowledgeBase: { ...knowledgeBase, documentCount: count ?? 0 } });
}

export async function PATCH(request: Request, { params }: RouteParams) {
  const auth = await requireRagUser();
  if (!auth.ok) return auth.response;
  const { kbId } = await params;

  const body = await request.json().catch(() => null);
  const parsed = updateKnowledgeBaseSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid request" },
      { status: 400 }
    );
  }
  if (Object.keys(parsed.data).length === 0) {
    return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
  }

  const { data, error } = await auth.supabase
    .from("knowledge_bases")
    .update(parsed.data)
    .eq("id", kbId)
    .eq("owner_id", auth.userId)
    .select("*")
    .single();
  if (error || !data) {
    return NextResponse.json({ error: error?.message ?? "Knowledge base not found" }, { status: 404 });
  }

  return NextResponse.json({ knowledgeBase: data });
}

export async function DELETE(_request: Request, { params }: RouteParams) {
  const auth = await requireRagUser();
  if (!auth.ok) return auth.response;
  const { kbId } = await params;

  const { error } = await auth.supabase
    .from("knowledge_bases")
    .delete()
    .eq("id", kbId)
    .eq("owner_id", auth.userId);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
