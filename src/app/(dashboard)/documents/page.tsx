import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { ConnectSupabaseNotice } from "@/components/dashboard/connect-supabase-notice";
import { DocumentCard, type DocumentSummary } from "@/components/documents/document-card";
import { UploadDocumentDialog } from "@/components/documents/upload-document-dialog";
import { PageHeader } from "@/components/layout/page-header";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Documents" };

async function loadDocuments(): Promise<DocumentSummary[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/documents");

  const { data } = await supabase
    .from("documents")
    .select("id, name, file_type, status, summary, warning, error, size_bytes, created_at")
    .eq("owner_id", user.id)
    .order("created_at", { ascending: false });

  return data ?? [];
}

export default async function DocumentsPage() {
  const configured = isSupabaseConfigured();
  const documents = configured ? await loadDocuments() : [];

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
      <PageHeader
        title="Documents"
        description="Upload a PDF, DOCX, XLSX, or image — extract, summarize, and ask questions."
      >
        <UploadDocumentDialog />
      </PageHeader>

      {!configured ? <ConnectSupabaseNotice /> : null}

      {configured && documents.length === 0 ? (
        <div className="text-muted-foreground rounded-lg border border-dashed py-16 text-center text-sm">
          No documents yet — upload one to get started.
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {documents.map((document) => (
            <DocumentCard key={document.id} document={document} />
          ))}
        </div>
      )}
    </div>
  );
}
