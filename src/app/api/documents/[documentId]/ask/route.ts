import { NextResponse } from "next/server";

import { askDocumentQuestion } from "@/lib/documents/ai";
import { loadOwnedDocument, requireDocumentUser } from "@/lib/documents/access";
import { rateLimit, rateLimitHeaders } from "@/lib/rate-limit";
import { askDocumentSchema } from "@/lib/validations/documents";

export const maxDuration = 60;

type RouteParams = { params: Promise<{ documentId: string }> };

function requestsPerMinute() {
  const configured = Number(process.env.NVIDIA_RATE_LIMIT_RPM);
  return Number.isFinite(configured) && configured > 0 ? configured : 20;
}

/**
 * POST /api/documents/[documentId]/ask — single-shot Q&A over the
 * document's extracted text (stateless — no persisted conversation;
 * full "chat with documents" with retrieval lands in a later phase).
 * Body: { question, provider?, model? }.
 */
export async function POST(request: Request, { params }: RouteParams) {
  const auth = await requireDocumentUser();
  if (!auth.ok) return auth.response;
  const { documentId } = await params;

  const limit = rateLimit(`document-ask:${auth.userId}`, {
    limit: requestsPerMinute(),
    windowMs: 60_000,
  });
  if (!limit.success) {
    return NextResponse.json(
      { error: "Too many requests — please slow down." },
      { status: 429, headers: rateLimitHeaders(limit) }
    );
  }

  const document = await loadOwnedDocument(auth.supabase, auth.userId, documentId);
  if (!document) {
    return NextResponse.json({ error: "Document not found" }, { status: 404 });
  }
  if (!document.extracted_text.trim()) {
    return NextResponse.json(
      { error: "This document has no extracted text to answer from." },
      { status: 400 }
    );
  }

  const body = await request.json().catch(() => null);
  const parsed = askDocumentSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid request" },
      { status: 400 }
    );
  }

  try {
    const { text: answer } = await askDocumentQuestion({
      providerId: parsed.data.provider ?? document.provider,
      model: parsed.data.model ?? document.model ?? undefined,
      text: document.extracted_text,
      question: parsed.data.question,
    });

    return NextResponse.json({ answer }, { headers: rateLimitHeaders(limit) });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Couldn't answer that question." },
      { status: 502 }
    );
  }
}
