import { NextResponse } from "next/server";

import { requireWorkflowUser } from "@/lib/workflows/access";
import { createWorkflowSchema } from "@/lib/validations/workflows";

/**
 * GET /api/workflows — the caller's own workflows, newest first.
 *
 * POST /api/workflows — create one (empty until steps are added).
 */
export async function GET() {
  const auth = await requireWorkflowUser();
  if (!auth.ok) return auth.response;

  const { data, error } = await auth.supabase
    .from("workflows")
    .select("*")
    .eq("owner_id", auth.userId)
    .order("created_at", { ascending: false });
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ workflows: data });
}

export async function POST(request: Request) {
  const auth = await requireWorkflowUser();
  if (!auth.ok) return auth.response;

  const body = await request.json().catch(() => null);
  const parsed = createWorkflowSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid request" },
      { status: 400 }
    );
  }

  const { data, error } = await auth.supabase
    .from("workflows")
    .insert({
      owner_id: auth.userId,
      name: parsed.data.name,
      description: parsed.data.description ?? null,
    })
    .select("*")
    .single();
  if (error || !data) {
    return NextResponse.json(
      { error: error?.message ?? "Failed to create workflow" },
      { status: 500 }
    );
  }

  return NextResponse.json({ workflow: data }, { status: 201 });
}
