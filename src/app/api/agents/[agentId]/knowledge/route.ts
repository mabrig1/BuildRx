import { NextResponse } from "next/server";

import { requireAgentUser } from "@/lib/ai-agents/access";
import { knowledgeFileSchema } from "@/lib/validations/agents";

type RouteParams = { params: Promise<{ agentId: string }> };

const MAX_FILES_PER_AGENT = 5;

/**
 * GET /api/agents/[agentId]/knowledge — list an agent's knowledge files
 * (owner only, regardless of the agent's visibility).
 *
 * POST — add one. Plain text only for now (paste, or a .txt/.md
 * upload read client-side) — PDF/DOCX/image extraction is Document AI
 * (a later phase), not this one.
 */
export async function GET(_request: Request, { params }: RouteParams) {
  const auth = await requireAgentUser();
  if (!auth.ok) return auth.response;
  const { agentId } = await params;

  const { data, error } = await auth.supabase
    .from("agent_knowledge_files")
    .select("id, name, size_bytes, created_at")
    .eq("agent_id", agentId)
    .order("created_at", { ascending: false });
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ files: data });
}

export async function POST(request: Request, { params }: RouteParams) {
  const auth = await requireAgentUser();
  if (!auth.ok) return auth.response;
  const { agentId } = await params;

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
      { error: "Only the owner can add knowledge files." },
      { status: 403 }
    );
  }

  const { count } = await auth.supabase
    .from("agent_knowledge_files")
    .select("id", { count: "exact", head: true })
    .eq("agent_id", agentId);
  if ((count ?? 0) >= MAX_FILES_PER_AGENT) {
    return NextResponse.json(
      { error: `Agents are limited to ${MAX_FILES_PER_AGENT} knowledge files.` },
      { status: 400 }
    );
  }

  const body = await request.json().catch(() => null);
  const parsed = knowledgeFileSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid request" },
      { status: 400 }
    );
  }

  const { data, error } = await auth.supabase
    .from("agent_knowledge_files")
    .insert({
      agent_id: agentId,
      name: parsed.data.name,
      content: parsed.data.content,
      size_bytes: new TextEncoder().encode(parsed.data.content).length,
    })
    .select("id, name, size_bytes, created_at")
    .single();
  if (error || !data) {
    return NextResponse.json(
      { error: error?.message ?? "Failed to add knowledge file" },
      { status: 500 }
    );
  }

  return NextResponse.json({ file: data }, { status: 201 });
}
