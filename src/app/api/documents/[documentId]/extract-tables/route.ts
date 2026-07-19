import { NextResponse } from "next/server";

import { extractTablesFromText } from "@/lib/documents/ai";
import { loadOwnedDocument, requireDocumentUser } from "@/lib/documents/access";
import { documentAiOptionsSchema } from "@/lib/validations/documents";

export const maxDuration = 60;

type RouteParams = { params: Promise<{ documentId: string }> };

/**
 * POST /api/documents/[documentId]/extract-tables — AI-inferred table
 * extraction from the document's text, returned as markdown and
 * cached. For XLSX documents, real (not AI-inferred) tables are
 * already populated at upload time in the `tables` field — this is
 * for PDF/DOCX/image documents where table detection needs the model.
 */
export async function POST(request: Request, { params }: RouteParams) {
  const auth = await requireDocumentUser();
  if (!auth.ok) return auth.response;
  const { documentId } = await params;

  const document = await loadOwnedDocument(auth.supabase, auth.userId, documentId);
  if (!document) {
    return NextResponse.json({ error: "Document not found" }, { status: 404 });
  }
  if (!document.extracted_text.trim()) {
    return NextResponse.json(
      { error: "This document has no extracted text to search for tables." },
      { status: 400 }
    );
  }

  const body = await request.json().catch(() => ({}));
  const parsed = documentAiOptionsSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid request" },
      { status: 400 }
    );
  }

  try {
    const { text: tablesMarkdown } = await extractTablesFromText({
      providerId: parsed.data.provider ?? document.provider,
      model: parsed.data.model ?? document.model ?? undefined,
      text: document.extracted_text,
    });

    await auth.supabase
      .from("documents")
      .update({ tables_markdown: tablesMarkdown })
      .eq("id", documentId);

    return NextResponse.json({ tablesMarkdown });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Table extraction failed." },
      { status: 502 }
    );
  }
}
