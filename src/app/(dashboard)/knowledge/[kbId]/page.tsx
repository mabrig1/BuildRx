import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

import { PageHeader } from "@/components/layout/page-header";
import { KnowledgeBaseChat } from "@/components/knowledge/kb-chat";
import { KnowledgeDocumentList } from "@/components/knowledge/kb-document-list";
import { KnowledgeBaseHeaderActions } from "@/components/knowledge/kb-header-actions";
import { KnowledgeBaseUploadDialog } from "@/components/knowledge/kb-upload-dialog";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";

type RouteParams = { params: Promise<{ kbId: string }> };

export async function generateMetadata({ params }: RouteParams): Promise<Metadata> {
  const { kbId } = await params;
  return { title: `Knowledge base · ${kbId}` };
}

export default async function KnowledgeBasePage({ params }: RouteParams) {
  const { kbId } = await params;

  if (!isSupabaseConfigured()) notFound();

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=/knowledge/${kbId}`);

  const { data: knowledgeBase } = await supabase
    .from("knowledge_bases")
    .select("*")
    .eq("id", kbId)
    .eq("owner_id", user.id)
    .maybeSingle();
  if (!knowledgeBase) notFound();

  const { data: documents } = await supabase
    .from("knowledge_documents")
    .select("id, name, file_type, status, chunk_count, warning, error, created_at")
    .eq("knowledge_base_id", kbId)
    .order("created_at", { ascending: false });

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
      <PageHeader title={knowledgeBase.name} description={knowledgeBase.description ?? undefined}>
        <KnowledgeBaseUploadDialog knowledgeBaseId={kbId} />
        <KnowledgeBaseHeaderActions
          knowledgeBaseId={kbId}
          initialName={knowledgeBase.name}
          initialDescription={knowledgeBase.description}
        />
      </PageHeader>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
        <div className="flex flex-col gap-3">
          <h2 className="text-lg font-semibold">Documents</h2>
          <KnowledgeDocumentList knowledgeBaseId={kbId} documents={documents ?? []} />
        </div>
        <div className="flex flex-col gap-3">
          <h2 className="text-lg font-semibold">Chat</h2>
          <KnowledgeBaseChat knowledgeBaseId={kbId} />
        </div>
      </div>
    </div>
  );
}
