import { NextResponse } from "next/server";

import { requireRagUser } from "@/lib/rag/access";

type RouteParams = { params: Promise<{ kbId: string; documentId: string }> };

/**
 * GET /api/rag/knowledge-bases/[kbId]/documents/[documentId] — one document's status/metadata.
 *
 * DELETE — remove it (cascades to its chunks).
 */
export async function GET(_request: Request, { params }: RouteParams) {
  const auth = await requireRagUser();
  if (!auth.ok) return auth.response;
  const { kbId, documentId } = await params;

  const { data, error } = await auth.supabase
    .from("knowledge_documents")
    .select("*")
    .eq("id", documentId)
    .eq("knowledge_base_id", kbId)
    .eq("owner_id", auth.userId)
    .maybeSingle();
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json({ error: "Document not found" }, { status: 404 });
  }

  return NextResponse.json({ document: data });
}

export async function DELETE(_request: Request, { params }: RouteParams) {
  const auth = await requireRagUser();
  if (!auth.ok) return auth.response;
  const { kbId, documentId } = await params;

  const { error } = await auth.supabase
    .from("knowledge_documents")
    .delete()
    .eq("id", documentId)
    .eq("knowledge_base_id", kbId)
    .eq("owner_id", auth.userId);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
