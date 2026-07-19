import { NextResponse } from "next/server";

import { loadOwnedWorkflow, requireWorkflowUser } from "@/lib/workflows/access";
import { runWorkflow } from "@/lib/workflows/engine";
import { runWorkflowSchema } from "@/lib/validations/workflows";

export const maxDuration = 180;

type RouteParams = { params: Promise<{ workflowId: string }> };

/**
 * POST /api/workflows/[workflowId]/run — run this workflow now. Body
 * (optional): `{ input? }` — seeds `{{trigger.text}}` for the first
 * step. Runs synchronously; the response includes the final status
 * once every step has finished (or one has failed).
 */
export async function POST(request: Request, { params }: RouteParams) {
  const auth = await requireWorkflowUser();
  if (!auth.ok) return auth.response;
  const { workflowId } = await params;

  const workflow = await loadOwnedWorkflow(auth.supabase, auth.userId, workflowId);
  if (!workflow) {
    return NextResponse.json({ error: "Workflow not found" }, { status: 404 });
  }

  const body = await request.json().catch(() => ({}));
  const parsed = runWorkflowSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid request" },
      { status: 400 }
    );
  }

  const { data: steps, error: stepsError } = await auth.supabase
    .from("workflow_steps")
    .select("*")
    .eq("workflow_id", workflowId)
    .order("position", { ascending: true });
  if (stepsError) {
    return NextResponse.json({ error: stepsError.message }, { status: 500 });
  }
  if (!steps || steps.length === 0) {
    return NextResponse.json({ error: "This workflow has no steps yet." }, { status: 400 });
  }

  const outcome = await runWorkflow({
    supabase: auth.supabase,
    ownerId: auth.userId,
    workflowId,
    steps,
    trigger: "manual",
    triggerInput: parsed.data.input ?? null,
  });

  return NextResponse.json(outcome, { status: outcome.status === "failed" ? 502 : 200 });
}
