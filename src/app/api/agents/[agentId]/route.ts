import { randomBytes } from "node:crypto";

import { NextResponse } from "next/server";

import { requireAgentUser } from "@/lib/ai-agents/access";
import { updateAgentSchema } from "@/lib/validations/agents";

type RouteParams = { params: Promise<{ agentId: string }> };

/**
 * GET /api/agents/[agentId] — fetch one agent (RLS: owner or non-private).
 * PATCH — update (owner only).
 * DELETE — delete (owner only).
 */
export async function GET(_request: Request, { params }: RouteParams) {
  const auth = await requireAgentUser();
  if (!auth.ok) return auth.response;
  const { agentId } = await params;

  const { data, error } = await auth.supabase
    .from("agents")
    .select("*")
    .eq("id", agentId)
    .maybeSingle();
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json({ error: "Agent not found" }, { status: 404 });
  }

  return NextResponse.json({ agent: data });
}

export async function PATCH(request: Request, { params }: RouteParams) {
  const auth = await requireAgentUser();
  if (!auth.ok) return auth.response;
  const { agentId } = await params;

  const existing = await auth.supabase
    .from("agents")
    .select("id, owner_id, visibility, share_slug")
    .eq("id", agentId)
    .maybeSingle();
  if (!existing.data) {
    return NextResponse.json({ error: "Agent not found" }, { status: 404 });
  }
  if (existing.data.owner_id !== auth.userId) {
    return NextResponse.json(
      { error: "Only the owner can edit this agent." },
      { status: 403 }
    );
  }

  const body = await request.json().catch(() => null);
  const parsed = updateAgentSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid request" },
      { status: 400 }
    );
  }
  const input = parsed.data;

  // Moving off 'private' for the first time mints a shareable slug.
  const needsSlug =
    input.visibility &&
    input.visibility !== "private" &&
    !existing.data.share_slug;

  const { data, error } = await auth.supabase
    .from("agents")
    .update({
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.description !== undefined ? { description: input.description || null } : {}),
      ...(input.icon !== undefined ? { icon: input.icon } : {}),
      ...(input.systemPrompt !== undefined ? { system_prompt: input.systemPrompt } : {}),
      ...(input.provider !== undefined ? { provider: input.provider } : {}),
      ...(input.model !== undefined ? { model: input.model } : {}),
      ...(input.tools !== undefined ? { tools: input.tools } : {}),
      ...(input.visibility !== undefined ? { visibility: input.visibility } : {}),
      ...(needsSlug ? { share_slug: randomBytes(6).toString("hex") } : {}),
    })
    .eq("id", agentId)
    .select("*")
    .single();
  if (error || !data) {
    return NextResponse.json(
      { error: error?.message ?? "Failed to update agent" },
      { status: 500 }
    );
  }

  return NextResponse.json({ agent: data });
}

export async function DELETE(_request: Request, { params }: RouteParams) {
  const auth = await requireAgentUser();
  if (!auth.ok) return auth.response;
  const { agentId } = await params;

  const existing = await auth.supabase
    .from("agents")
    .select("id, owner_id")
    .eq("id", agentId)
    .maybeSingle();
  if (!existing.data) {
    return NextResponse.json({ error: "Agent not found" }, { status: 404 });
  }
  if (existing.data.owner_id !== auth.userId) {
    return NextResponse.json(
      { error: "Only the owner can delete this agent." },
      { status: 403 }
    );
  }

  const { error } = await auth.supabase.from("agents").delete().eq("id", agentId);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
