import { NextResponse } from "next/server";

import { generateDocumentReport } from "@/lib/documents/ai";
import { loadOwnedDocument, requireDocumentUser } from "@/lib/documents/access";
import { documentAiOptionsSchema } from "@/lib/validations/documents";

export const maxDuration = 90;

type RouteParams = { params: Promise<{ documentId: string }> };

/**
 * POST /api/documents/[documentId]/report — (re)generate and cache a
 * structured markdown report (executive summary, key findings, tables).
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
      { error: "This document has no extracted text to report on." },
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
    const { text: report } = await generateDocumentReport({
      providerId: parsed.data.provider ?? document.provider,
      model: parsed.data.model ?? document.model ?? undefined,
      text: document.extracted_text,
      documentName: document.name,
    });

    await auth.supabase
      .from("documents")
      .update({ report_markdown: report })
      .eq("id", documentId);

    return NextResponse.json({ report });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Report generation failed." },
      { status: 502 }
    );
  }
}
