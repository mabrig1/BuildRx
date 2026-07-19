import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

import { DocumentDetail, type DocumentDetailData } from "@/components/documents/document-detail";
import { PageHeader } from "@/components/layout/page-header";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";

type RouteParams = { params: Promise<{ documentId: string }> };

export async function generateMetadata({ params }: RouteParams): Promise<Metadata> {
  const { documentId } = await params;
  return { title: `Document · ${documentId}` };
}

export default async function DocumentPage({ params }: RouteParams) {
  const { documentId } = await params;

  if (!isSupabaseConfigured()) notFound();

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=/documents/${documentId}`);

  const { data } = await supabase
    .from("documents")
    .select("*")
    .eq("id", documentId)
    .eq("owner_id", user.id)
    .maybeSingle();
  if (!data) notFound();

  const document: DocumentDetailData = {
    id: data.id,
    name: data.name,
    file_type: data.file_type,
    status: data.status,
    extracted_text: data.extracted_text,
    tables: Array.isArray(data.tables) ? (data.tables as DocumentDetailData["tables"]) : [],
    summary: data.summary,
    tables_markdown: data.tables_markdown,
    report_markdown: data.report_markdown,
    warning: data.warning,
    error: data.error,
  };

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
      <PageHeader title={document.name} description={`${document.file_type.toUpperCase()} document`} />
      <DocumentDetail document={document} />
    </div>
  );
}
