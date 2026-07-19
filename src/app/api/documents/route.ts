import { NextResponse } from "next/server";

import { getProvider, listConfiguredProviders } from "@/lib/ai/providers/registry";
import { summarizeDocumentText } from "@/lib/documents/ai";
import { requireDocumentUser } from "@/lib/documents/access";
import { detectFileType, extractDocument } from "@/lib/documents/extract";
import type { Json } from "@/types/database";

export const maxDuration = 90;

const MAX_FILE_BYTES = 10 * 1024 * 1024; // 10MB

/**
 * GET /api/documents — the caller's own documents, newest first
 * (excludes extracted_text/tables — fetch one document for the full
 * content).
 *
 * POST /api/documents — upload + extract in one step. multipart/form-
 * data with a `file` field. Extraction happens synchronously (no
 * background job/queue) and only the extracted content is persisted —
 * the original file bytes are discarded once extraction completes.
 */
export async function GET() {
  const auth = await requireDocumentUser();
  if (!auth.ok) return auth.response;

  const { data, error } = await auth.supabase
    .from("documents")
    .select("id, name, file_type, size_bytes, status, summary, warning, error, created_at, updated_at")
    .eq("owner_id", auth.userId)
    .order("created_at", { ascending: false });
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ documents: data });
}

export async function POST(request: Request) {
  const auth = await requireDocumentUser();
  if (!auth.ok) return auth.response;

  const form = await request.formData().catch(() => null);
  const file = form?.get("file");
  if (!file || !(file instanceof Blob) || file.size === 0) {
    return NextResponse.json({ error: "Attach a file to upload." }, { status: 400 });
  }
  if (file.size > MAX_FILE_BYTES) {
    return NextResponse.json(
      { error: "File is too large (max 10MB)." },
      { status: 400 }
    );
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

  let extraction: Awaited<ReturnType<typeof extractDocument>> | null = null;
  let extractionError: string | null = null;
  try {
    extraction = await extractDocument(buffer, fileType, file.type);
  } catch (error) {
    extractionError = error instanceof Error ? error.message : "Extraction failed.";
  }

  // A default provider/model for this document's future AI actions —
  // whichever provider happens to be configured first.
  const defaultProvider = listConfiguredProviders()[0];

  const insert = await auth.supabase
    .from("documents")
    .insert({
      owner_id: auth.userId,
      name: filename,
      file_type: fileType,
      size_bytes: file.size,
      status: extraction ? "ready" : "failed",
      extracted_text: extraction?.text ?? "",
      tables: (extraction?.tables ?? []) as unknown as Json,
      warning: extraction?.warning ?? null,
      error: extractionError,
      provider: defaultProvider?.id ?? "nvidia",
      model: defaultProvider?.defaultModel() ?? "",
    })
    .select("*")
    .single();
  if (insert.error || !insert.data) {
    return NextResponse.json(
      { error: insert.error?.message ?? "Failed to save document" },
      { status: 500 }
    );
  }

  // Best-effort auto-summary — a document is still usable without one.
  if (extraction && extraction.text.trim().length > 100 && defaultProvider) {
    try {
      const { text: summary } = await summarizeDocumentText({
        providerId: defaultProvider.id,
        model: getProvider(defaultProvider.id).defaultModel(),
        text: extraction.text,
      });
      await auth.supabase
        .from("documents")
        .update({ summary })
        .eq("id", insert.data.id);
      insert.data.summary = summary;
    } catch (error) {
      console.error("Auto-summary failed:", error);
    }
  }

  return NextResponse.json({ document: insert.data }, { status: 201 });
}
