import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

import { PageHeader } from "@/components/layout/page-header";
import { StepList } from "@/components/workflows/step-list";
import { WorkflowHeaderActions } from "@/components/workflows/workflow-header-actions";
import { WorkflowRunPanel } from "@/components/workflows/workflow-run-panel";
import { WorkflowTriggerPanel } from "@/components/workflows/workflow-trigger-panel";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";

type RouteParams = { params: Promise<{ workflowId: string }> };

export async function generateMetadata({ params }: RouteParams): Promise<Metadata> {
  const { workflowId } = await params;
  return { title: `Workflow · ${workflowId}` };
}

export default async function WorkflowPage({ params }: RouteParams) {
  const { workflowId } = await params;

  if (!isSupabaseConfigured()) notFound();

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=/workflows/${workflowId}`);

  const { data: workflow } = await supabase
    .from("workflows")
    .select("*")
    .eq("id", workflowId)
    .eq("owner_id", user.id)
    .maybeSingle();
  if (!workflow) notFound();

  const { data: steps } = await supabase
    .from("workflow_steps")
    .select("id, name, type, position, config")
    .eq("workflow_id", workflowId)
    .order("position", { ascending: true });

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
      <PageHeader title={workflow.name} description={workflow.description ?? undefined}>
        <WorkflowHeaderActions
          workflowId={workflowId}
          initialName={workflow.name}
          initialDescription={workflow.description}
        />
      </PageHeader>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <div className="flex flex-col gap-6">
          <div>
            <h2 className="mb-3 text-lg font-semibold">Steps</h2>
            <StepList
              workflowId={workflowId}
              steps={(steps ?? []).map((s) => ({
                ...s,
                config: (s.config ?? {}) as Record<string, unknown>,
              }))}
            />
          </div>
          <div>
            <h2 className="mb-3 text-lg font-semibold">Run</h2>
            <WorkflowRunPanel workflowId={workflowId} />
          </div>
        </div>

        <div>
          <h2 className="mb-3 text-lg font-semibold">Trigger</h2>
          <WorkflowTriggerPanel
            workflowId={workflowId}
            enabled={workflow.enabled}
            triggerType={workflow.trigger_type}
            webhookToken={workflow.webhook_token}
          />
        </div>
      </div>
    </div>
  );
}
