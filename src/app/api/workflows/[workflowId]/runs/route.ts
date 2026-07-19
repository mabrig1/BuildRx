import { NextResponse } from "next/server";

import { loadOwnedWorkflow, requireWorkflowUser } from "@/lib/workflows/access";

type RouteParams = { params: Promise<{ workflowId: string }> };

/** GET /api/workflows/[workflowId]/runs — run history, newest first (last 50). */
export async function GET(_request: Request, { params }: RouteParams) {
  const auth = await requireWorkflowUser();
  if (!auth.ok) return auth.response;
  const { workflowId } = await params;

  const workflow = await loadOwnedWorkflow(auth.supabase, auth.userId, workflowId);
  if (!workflow) {
    return NextResponse.json({ error: "Workflow not found" }, { status: 404 });
  }

  const { data, error } = await auth.supabase
    .from("workflow_runs")
    .select("id, status, trigger, error, started_at, completed_at")
    .eq("workflow_id", workflowId)
    .order("started_at", { ascending: false })
    .limit(50);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ runs: data });
}
