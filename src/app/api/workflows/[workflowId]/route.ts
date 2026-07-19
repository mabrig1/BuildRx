import { NextResponse } from "next/server";

import { loadOwnedWorkflow, requireWorkflowUser } from "@/lib/workflows/access";
import { updateWorkflowSchema } from "@/lib/validations/workflows";

type RouteParams = { params: Promise<{ workflowId: string }> };

/**
 * GET /api/workflows/[workflowId] — the workflow plus its steps, in order.
 *
 * PATCH — update name/description/enabled/triggerType. DELETE — remove
 * it (cascades to its steps and run history).
 */
export async function GET(_request: Request, { params }: RouteParams) {
  const auth = await requireWorkflowUser();
  if (!auth.ok) return auth.response;
  const { workflowId } = await params;

  const workflow = await loadOwnedWorkflow(auth.supabase, auth.userId, workflowId);
  if (!workflow) {
    return NextResponse.json({ error: "Workflow not found" }, { status: 404 });
  }

  const { data: steps, error } = await auth.supabase
    .from("workflow_steps")
    .select("*")
    .eq("workflow_id", workflowId)
    .order("position", { ascending: true });
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ workflow, steps });
}

export async function PATCH(request: Request, { params }: RouteParams) {
  const auth = await requireWorkflowUser();
  if (!auth.ok) return auth.response;
  const { workflowId } = await params;

  const body = await request.json().catch(() => null);
  const parsed = updateWorkflowSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid request" },
      { status: 400 }
    );
  }
  if (Object.keys(parsed.data).length === 0) {
    return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
  }

  const { data, error } = await auth.supabase
    .from("workflows")
    .update({
      ...(parsed.data.name !== undefined ? { name: parsed.data.name } : {}),
      ...(parsed.data.description !== undefined ? { description: parsed.data.description } : {}),
      ...(parsed.data.enabled !== undefined ? { enabled: parsed.data.enabled } : {}),
      ...(parsed.data.triggerType !== undefined ? { trigger_type: parsed.data.triggerType } : {}),
    })
    .eq("id", workflowId)
    .eq("owner_id", auth.userId)
    .select("*")
    .single();
  if (error || !data) {
    return NextResponse.json({ error: error?.message ?? "Workflow not found" }, { status: 404 });
  }

  return NextResponse.json({ workflow: data });
}

export async function DELETE(_request: Request, { params }: RouteParams) {
  const auth = await requireWorkflowUser();
  if (!auth.ok) return auth.response;
  const { workflowId } = await params;

  const { error } = await auth.supabase
    .from("workflows")
    .delete()
    .eq("id", workflowId)
    .eq("owner_id", auth.userId);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
