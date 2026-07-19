import { NextResponse } from "next/server";

import { requireWorkflowUser } from "@/lib/workflows/access";

type RouteParams = { params: Promise<{ workflowId: string; runId: string }> };

/** GET /api/workflows/[workflowId]/runs/[runId] — the run plus each step's input/output/error, in order. */
export async function GET(_request: Request, { params }: RouteParams) {
  const auth = await requireWorkflowUser();
  if (!auth.ok) return auth.response;
  const { workflowId, runId } = await params;

  const run = await auth.supabase
    .from("workflow_runs")
    .select("*")
    .eq("id", runId)
    .eq("workflow_id", workflowId)
    .eq("owner_id", auth.userId)
    .maybeSingle();
  if (!run.data) {
    return NextResponse.json({ error: "Run not found" }, { status: 404 });
  }

  const { data: steps, error } = await auth.supabase
    .from("workflow_run_steps")
    .select("*")
    .eq("run_id", runId)
    .order("position", { ascending: true });
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ run: run.data, steps });
}
