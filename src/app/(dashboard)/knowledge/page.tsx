import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { ConnectSupabaseNotice } from "@/components/dashboard/connect-supabase-notice";
import { CreateKnowledgeBaseDialog } from "@/components/knowledge/create-kb-dialog";
import { KnowledgeBaseCard, type KnowledgeBaseSummary } from "@/components/knowledge/kb-card";
import { PageHeader } from "@/components/layout/page-header";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Knowledge Base" };

async function loadKnowledgeBases(): Promise<KnowledgeBaseSummary[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/knowledge");

  const { data } = await supabase
    .from("knowledge_bases")
    .select("id, name, description, created_at")
    .eq("owner_id", user.id)
    .order("created_at", { ascending: false });

  return data ?? [];
}

export default async function KnowledgeBasesPage() {
  const configured = isSupabaseConfigured();
  const knowledgeBases = configured ? await loadKnowledgeBases() : [];

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
      <PageHeader
        title="Knowledge Base"
        description="Upload documents and chat with them — grounded, cited answers via RAG."
      >
        <CreateKnowledgeBaseDialog />
      </PageHeader>

      {!configured ? <ConnectSupabaseNotice /> : null}

      {configured && knowledgeBases.length === 0 ? (
        <div className="text-muted-foreground rounded-lg border border-dashed py-16 text-center text-sm">
          No knowledge bases yet — create one to get started.
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {knowledgeBases.map((kb) => (
            <KnowledgeBaseCard key={kb.id} knowledgeBase={kb} />
          ))}
        </div>
      )}
    </div>
  );
}
