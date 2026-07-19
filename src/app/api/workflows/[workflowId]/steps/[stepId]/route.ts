import { NextResponse } from "next/server";

import { requireWorkflowUser } from "@/lib/workflows/access";
import { parseStepConfig, updateStepSchema } from "@/lib/validations/workflows";
import type { Json, WorkflowStepType } from "@/types/database";

type RouteParams = { params: Promise<{ workflowId: string; stepId: string }> };

/** PATCH /api/workflows/[workflowId]/steps/[stepId] — rename or reconfigure a step. DELETE — remove it. */
export async function PATCH(request: Request, { params }: RouteParams) {
  const auth = await requireWorkflowUser();
  if (!auth.ok) return auth.response;
  const { workflowId, stepId } = await params;

  const existing = await auth.supabase
    .from("workflow_steps")
    .select("type")
    .eq("id", stepId)
    .eq("workflow_id", workflowId)
    .eq("owner_id", auth.userId)
    .maybeSingle();
  if (!existing.data) {
    return NextResponse.json({ error: "Step not found" }, { status: 404 });
  }

  const body = await request.json().catch(() => null);
  const parsed = updateStepSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid request" },
      { status: 400 }
    );
  }
  if (Object.keys(parsed.data).length === 0) {
    return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
  }

  let config: Json | undefined;
  if (parsed.data.config !== undefined) {
    const configResult = parseStepConfig(existing.data.type as WorkflowStepType, parsed.data.config);
    if (!configResult.success) {
      return NextResponse.json(
        { error: configResult.error.issues[0]?.message ?? "Invalid step configuration" },
        { status: 400 }
      );
    }
    config = configResult.data as unknown as Json;
  }

  const { data, error } = await auth.supabase
    .from("workflow_steps")
    .update({
      ...(parsed.data.name !== undefined ? { name: parsed.data.name } : {}),
      ...(config !== undefined ? { config } : {}),
    })
    .eq("id", stepId)
    .eq("workflow_id", workflowId)
    .eq("owner_id", auth.userId)
    .select("*")
    .single();
  if (error || !data) {
    return NextResponse.json({ error: error?.message ?? "Step not found" }, { status: 404 });
  }

  return NextResponse.json({ step: data });
}

export async function DELETE(_request: Request, { params }: RouteParams) {
  const auth = await requireWorkflowUser();
  if (!auth.ok) return auth.response;
  const { workflowId, stepId } = await params;

  const { error } = await auth.supabase
    .from("workflow_steps")
    .delete()
    .eq("id", stepId)
    .eq("workflow_id", workflowId)
    .eq("owner_id", auth.userId);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
