import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { ConnectSupabaseNotice } from "@/components/dashboard/connect-supabase-notice";
import { PageHeader } from "@/components/layout/page-header";
import { CreateWorkflowDialog } from "@/components/workflows/create-workflow-dialog";
import { WorkflowCard, type WorkflowSummary } from "@/components/workflows/workflow-card";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Workflows" };

async function loadWorkflows(): Promise<WorkflowSummary[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/workflows");

  const { data } = await supabase
    .from("workflows")
    .select("id, name, description, enabled, trigger_type, created_at")
    .eq("owner_id", user.id)
    .order("created_at", { ascending: false });

  return data ?? [];
}

export default async function WorkflowsPage() {
  const configured = isSupabaseConfigured();
  const workflows = configured ? await loadWorkflows() : [];

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
      <PageHeader
        title="Workflows"
        description="Chain AI steps together — run manually or trigger from a webhook."
      >
        <CreateWorkflowDialog />
      </PageHeader>

      {!configured ? <ConnectSupabaseNotice /> : null}

      {configured && workflows.length === 0 ? (
        <div className="text-muted-foreground rounded-lg border border-dashed py-16 text-center text-sm">
          No workflows yet — create one to get started.
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {workflows.map((workflow) => (
            <WorkflowCard key={workflow.id} workflow={workflow} />
          ))}
        </div>
      )}
    </div>
  );
}
