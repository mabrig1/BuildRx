import { NextResponse } from "next/server";

import { summarizeDocumentText } from "@/lib/documents/ai";
import { loadOwnedDocument, requireDocumentUser } from "@/lib/documents/access";
import { documentAiOptionsSchema } from "@/lib/validations/documents";

export const maxDuration = 60;

type RouteParams = { params: Promise<{ documentId: string }> };

/**
 * POST /api/documents/[documentId]/summarize — (re)generate and cache
 * the document's summary. Body (optional): { provider?, model? }.
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
      { error: "This document has no extracted text to summarize." },
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
    const { text: summary } = await summarizeDocumentText({
      providerId: parsed.data.provider ?? document.provider,
      model: parsed.data.model ?? document.model ?? undefined,
      text: document.extracted_text,
    });

    await auth.supabase.from("documents").update({ summary }).eq("id", documentId);

    return NextResponse.json({ summary });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Summarization failed." },
      { status: 502 }
    );
  }
}
