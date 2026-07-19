import { NextResponse } from "next/server";

import { loadOwnedWorkflow, requireWorkflowUser } from "@/lib/workflows/access";
import { createStepSchema, parseStepConfig } from "@/lib/validations/workflows";
import type { Json } from "@/types/database";

type RouteParams = { params: Promise<{ workflowId: string }> };

/**
 * GET /api/workflows/[workflowId]/steps — steps in order.
 *
 * POST — append a new step at the end. Body: `{ name, type, config }` —
 * `config` is validated against the schema for `type` (see
 * validations/workflows.ts) before it's saved.
 */
export async function GET(_request: Request, { params }: RouteParams) {
  const auth = await requireWorkflowUser();
  if (!auth.ok) return auth.response;
  const { workflowId } = await params;

  const workflow = await loadOwnedWorkflow(auth.supabase, auth.userId, workflowId);
  if (!workflow) {
    return NextResponse.json({ error: "Workflow not found" }, { status: 404 });
  }

  const { data, error } = await auth.supabase
    .from("workflow_steps")
    .select("*")
    .eq("workflow_id", workflowId)
    .order("position", { ascending: true });
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ steps: data });
}

export async function POST(request: Request, { params }: RouteParams) {
  const auth = await requireWorkflowUser();
  if (!auth.ok) return auth.response;
  const { workflowId } = await params;

  const workflow = await loadOwnedWorkflow(auth.supabase, auth.userId, workflowId);
  if (!workflow) {
    return NextResponse.json({ error: "Workflow not found" }, { status: 404 });
  }

  const body = await request.json().catch(() => null);
  const parsed = createStepSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid request" },
      { status: 400 }
    );
  }

  const configResult = parseStepConfig(parsed.data.type, parsed.data.config);
  if (!configResult.success) {
    return NextResponse.json(
      { error: configResult.error.issues[0]?.message ?? "Invalid step configuration" },
      { status: 400 }
    );
  }

  const existing = await auth.supabase
    .from("workflow_steps")
    .select("position")
    .eq("workflow_id", workflowId)
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();
  const nextPosition = (existing.data?.position ?? 0) + 1;

  const { data, error } = await auth.supabase
    .from("workflow_steps")
    .insert({
      workflow_id: workflowId,
      owner_id: auth.userId,
      position: nextPosition,
      name: parsed.data.name,
      type: parsed.data.type,
      config: configResult.data as unknown as Json,
    })
    .select("*")
    .single();
  if (error || !data) {
    return NextResponse.json(
      { error: error?.message ?? "Failed to create step" },
      { status: 500 }
    );
  }

  return NextResponse.json({ step: data }, { status: 201 });
}
