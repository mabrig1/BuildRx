import { NextResponse } from "next/server";

import { requireAgentUser } from "@/lib/ai-agents/access";

type RouteParams = { params: Promise<{ agentId: string; fileId: string }> };

/** DELETE /api/agents/[agentId]/knowledge/[fileId] — owner only. */
export async function DELETE(_request: Request, { params }: RouteParams) {
  const auth = await requireAgentUser();
  if (!auth.ok) return auth.response;
  const { agentId, fileId } = await params;

  const agent = await auth.supabase
    .from("agents")
    .select("owner_id")
    .eq("id", agentId)
    .maybeSingle();
  if (!agent.data) {
    return NextResponse.json({ error: "Agent not found" }, { status: 404 });
  }
  if (agent.data.owner_id !== auth.userId) {
    return NextResponse.json(
      { error: "Only the owner can remove knowledge files." },
      { status: 403 }
    );
  }

  const { error } = await auth.supabase
    .from("agent_knowledge_files")
    .delete()
    .eq("id", fileId)
    .eq("agent_id", agentId);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
