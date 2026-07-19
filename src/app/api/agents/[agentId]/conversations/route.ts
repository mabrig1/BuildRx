import { NextResponse } from "next/server";

import { requireAgentUser } from "@/lib/ai-agents/access";
import { createConversationSchema } from "@/lib/validations/agents";

type RouteParams = { params: Promise<{ agentId: string }> };

/**
 * GET /api/agents/[agentId]/conversations — the caller's own
 * conversation threads with this agent (their private memory of it).
 *
 * POST — start a new one.
 */
export async function GET(_request: Request, { params }: RouteParams) {
  const auth = await requireAgentUser();
  if (!auth.ok) return auth.response;
  const { agentId } = await params;

  const { data, error } = await auth.supabase
    .from("agent_conversations")
    .select("id, title, created_at, updated_at")
    .eq("agent_id", agentId)
    .eq("user_id", auth.userId)
    .order("updated_at", { ascending: false });
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ conversations: data });
}

export async function POST(request: Request, { params }: RouteParams) {
  const auth = await requireAgentUser();
  if (!auth.ok) return auth.response;
  const { agentId } = await params;

  const body = await request.json().catch(() => ({}));
  const parsed = createConversationSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid request" },
      { status: 400 }
    );
  }

  const { data, error } = await auth.supabase
    .from("agent_conversations")
    .insert({
      agent_id: agentId,
      user_id: auth.userId,
      title: parsed.data.title || null,
    })
    .select("id, title, created_at, updated_at")
    .single();
  if (error || !data) {
    return NextResponse.json(
      { error: error?.message ?? "Failed to start conversation — is this agent accessible to you?" },
      { status: 500 }
    );
  }

  return NextResponse.json({ conversation: data }, { status: 201 });
}
