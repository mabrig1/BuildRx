import { NextResponse } from "next/server";

import { requireDocumentUser } from "@/lib/documents/access";

type RouteParams = { params: Promise<{ documentId: string }> };

/**
 * GET /api/documents/[documentId] — full document, including extracted
 * text/tables/summary/report (RLS: owner only).
 *
 * DELETE — remove it.
 */
export async function GET(_request: Request, { params }: RouteParams) {
  const auth = await requireDocumentUser();
  if (!auth.ok) return auth.response;
  const { documentId } = await params;

  const { data, error } = await auth.supabase
    .from("documents")
    .select("*")
    .eq("id", documentId)
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
  const auth = await requireDocumentUser();
  if (!auth.ok) return auth.response;
  const { documentId } = await params;

  const { error } = await auth.supabase
    .from("documents")
    .delete()
    .eq("id", documentId)
    .eq("owner_id", auth.userId);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
