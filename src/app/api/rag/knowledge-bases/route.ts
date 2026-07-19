import { NextResponse } from "next/server";

import { requireRagUser } from "@/lib/rag/access";
import { createKnowledgeBaseSchema } from "@/lib/validations/rag";

/**
 * GET /api/rag/knowledge-bases — the caller's own knowledge bases, newest first.
 *
 * POST /api/rag/knowledge-bases — create a new one. Empty until documents are uploaded.
 */
export async function GET() {
  const auth = await requireRagUser();
  if (!auth.ok) return auth.response;

  const { data, error } = await auth.supabase
    .from("knowledge_bases")
    .select("*")
    .eq("owner_id", auth.userId)
    .order("created_at", { ascending: false });
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ knowledgeBases: data });
}

export async function POST(request: Request) {
  const auth = await requireRagUser();
  if (!auth.ok) return auth.response;

  const body = await request.json().catch(() => null);
  const parsed = createKnowledgeBaseSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid request" },
      { status: 400 }
    );
  }

  const { data, error } = await auth.supabase
    .from("knowledge_bases")
    .insert({
      owner_id: auth.userId,
      name: parsed.data.name,
      description: parsed.data.description ?? null,
    })
    .select("*")
    .single();
  if (error || !data) {
    return NextResponse.json(
      { error: error?.message ?? "Failed to create knowledge base" },
      { status: 500 }
    );
  }

  return NextResponse.json({ knowledgeBase: data }, { status: 201 });
}
