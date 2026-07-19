import { NextResponse } from "next/server";

import { requireWorkflowUser } from "@/lib/workflows/access";
import { reorderStepsSchema } from "@/lib/validations/workflows";

type RouteParams = { params: Promise<{ workflowId: string }> };

/**
 * POST /api/workflows/[workflowId]/steps/reorder — body `{ stepIds }`,
 * the full set of this workflow's step ids in the desired order.
 * Positions are written in two passes (temporary negative values, then
 * final 1-based ones) so the `unique(workflow_id, position)` constraint
 * never rejects an intermediate state.
 */
export async function POST(request: Request, { params }: RouteParams) {
  const auth = await requireWorkflowUser();
  if (!auth.ok) return auth.response;
  const { workflowId } = await params;

  const body = await request.json().catch(() => null);
  const parsed = reorderStepsSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid request" },
      { status: 400 }
    );
  }

  const existing = await auth.supabase
    .from("workflow_steps")
    .select("id")
    .eq("workflow_id", workflowId)
    .eq("owner_id", auth.userId);
  const existingIds = new Set((existing.data ?? []).map((s) => s.id));
  const { stepIds } = parsed.data;

  if (stepIds.length !== existingIds.size || stepIds.some((id) => !existingIds.has(id))) {
    return NextResponse.json(
      { error: "stepIds must include exactly this workflow's current steps" },
      { status: 400 }
    );
  }

  for (let i = 0; i < stepIds.length; i++) {
    const { error } = await auth.supabase
      .from("workflow_steps")
      .update({ position: -(i + 1) })
      .eq("id", stepIds[i])
      .eq("owner_id", auth.userId);
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
  }
  for (let i = 0; i < stepIds.length; i++) {
    const { error } = await auth.supabase
      .from("workflow_steps")
      .update({ position: i + 1 })
      .eq("id", stepIds[i])
      .eq("owner_id", auth.userId);
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
  }

  return NextResponse.json({ success: true });
}
