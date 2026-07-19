import { NextResponse } from "next/server";

import { detectFileType, extractDocument } from "@/lib/documents/extract";
import { ingestDocumentText } from "@/lib/rag/ingest";
import { loadOwnedKnowledgeBase, requireRagUser } from "@/lib/rag/access";

export const maxDuration = 120;

const MAX_FILE_BYTES = 10 * 1024 * 1024; // 10MB

type RouteParams = { params: Promise<{ kbId: string }> };

/**
 * GET /api/rag/knowledge-bases/[kbId]/documents — documents in this KB, newest first.
 *
 * POST — upload + extract + chunk + embed in one step. multipart/form-
 * data with a `file` field. Synchronous (no background job/queue), so
 * this can take a while for a long document — maxDuration is raised
 * accordingly.
 */
export async function GET(_request: Request, { params }: RouteParams) {
  const auth = await requireRagUser();
  if (!auth.ok) return auth.response;
  const { kbId } = await params;

  const knowledgeBase = await loadOwnedKnowledgeBase(auth.supabase, auth.userId, kbId);
  if (!knowledgeBase) {
    return NextResponse.json({ error: "Knowledge base not found" }, { status: 404 });
  }

  const { data, error } = await auth.supabase
    .from("knowledge_documents")
    .select("id, name, file_type, size_bytes, status, chunk_count, warning, error, created_at")
    .eq("knowledge_base_id", kbId)
    .order("created_at", { ascending: false });
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ documents: data });
}

export async function POST(request: Request, { params }: RouteParams) {
  const auth = await requireRagUser();
  if (!auth.ok) return auth.response;
  const { kbId } = await params;

  const knowledgeBase = await loadOwnedKnowledgeBase(auth.supabase, auth.userId, kbId);
  if (!knowledgeBase) {
    return NextResponse.json({ error: "Knowledge base not found" }, { status: 404 });
  }

  const form = await request.formData().catch(() => null);
  const file = form?.get("file");
  if (!file || !(file instanceof Blob) || file.size === 0) {
    return NextResponse.json({ error: "Attach a file to upload." }, { status: 400 });
  }
  if (file.size > MAX_FILE_BYTES) {
    return NextResponse.json({ error: "File is too large (max 10MB)." }, { status: 400 });
  }

  const filename = file instanceof File ? file.name : "upload";
  const fileType = detectFileType(file.type, filename);
  if (!fileType) {
    return NextResponse.json(
      { error: "Unsupported file type — upload a PDF, DOCX, XLSX, or image." },
      { status: 400 }
    );
  }

  const buffer = Buffer.from(await file.arrayBuffer());

  let extractedText = "";
  let warning: string | null = null;
  let extractionError: string | null = null;
  try {
    const extraction = await extractDocument(buffer, fileType, file.type);
    extractedText = extraction.text;
    warning = extraction.warning ?? null;
  } catch (error) {
    extractionError = error instanceof Error ? error.message : "Extraction failed.";
  }

  const insert = await auth.supabase
    .from("knowledge_documents")
    .insert({
      knowledge_base_id: kbId,
      owner_id: auth.userId,
      name: filename,
      file_type: fileType,
      size_bytes: file.size,
      status: extractionError ? "failed" : "processing",
      warning,
      error: extractionError,
    })
    .select("*")
    .single();
  if (insert.error || !insert.data) {
    return NextResponse.json(
      { error: insert.error?.message ?? "Failed to save document" },
      { status: 500 }
    );
  }

  if (extractionError) {
    return NextResponse.json({ document: insert.data }, { status: 201 });
  }

  if (extractedText.trim().length === 0) {
    const { data } = await auth.supabase
      .from("knowledge_documents")
      .update({ status: "failed", error: "No text could be extracted from this document." })
      .eq("id", insert.data.id)
      .select("*")
      .single();
    return NextResponse.json({ document: data ?? insert.data }, { status: 201 });
  }

  try {
    const { chunkCount } = await ingestDocumentText({
      supabase: auth.supabase,
      ownerId: auth.userId,
      knowledgeBaseId: kbId,
      documentId: insert.data.id,
      text: extractedText,
    });
    const { data } = await auth.supabase
      .from("knowledge_documents")
      .update({ status: "ready", chunk_count: chunkCount })
      .eq("id", insert.data.id)
      .select("*")
      .single();
    return NextResponse.json({ document: data ?? insert.data }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Embedding failed.";
    const { data } = await auth.supabase
      .from("knowledge_documents")
      .update({ status: "failed", error: message })
      .eq("id", insert.data.id)
      .select("*")
      .single();
    return NextResponse.json({ document: data ?? insert.data }, { status: 201 });
  }
}
