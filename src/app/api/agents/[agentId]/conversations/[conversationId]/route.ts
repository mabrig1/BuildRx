import { NextResponse } from "next/server";

import { requireAgentUser } from "@/lib/ai-agents/access";

type RouteParams = {
  params: Promise<{ agentId: string; conversationId: string }>;
};

/**
 * GET /api/agents/[agentId]/conversations/[conversationId] — the
 * conversation's messages, oldest first (RLS: caller's own only).
 *
 * DELETE — remove the conversation and its messages.
 */
export async function GET(_request: Request, { params }: RouteParams) {
  const auth = await requireAgentUser();
  if (!auth.ok) return auth.response;
  const { conversationId } = await params;

  const { data, error } = await auth.supabase
    .from("agent_messages")
    .select("id, role, content, tool_calls, tool_name, tool_call_id, created_at")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true });
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ messages: data });
}

export async function DELETE(_request: Request, { params }: RouteParams) {
  const auth = await requireAgentUser();
  if (!auth.ok) return auth.response;
  const { conversationId } = await params;

  const { error } = await auth.supabase
    .from("agent_conversations")
    .delete()
    .eq("id", conversationId)
    .eq("user_id", auth.userId);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
