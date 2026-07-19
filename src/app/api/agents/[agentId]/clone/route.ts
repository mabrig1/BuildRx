import { NextResponse } from "next/server";

import { requireAgentUser } from "@/lib/ai-agents/access";

type RouteParams = { params: Promise<{ agentId: string }> };

/**
 * POST /api/agents/[agentId]/clone — "Use this agent" from the
 * marketplace: copies the config (name, prompt, provider/model, tools)
 * into a new private agent owned by the caller. Knowledge files and
 * memory are deliberately not copied — the clone starts fresh.
 */
export async function POST(_request: Request, { params }: RouteParams) {
  const auth = await requireAgentUser();
  if (!auth.ok) return auth.response;
  const { agentId } = await params;

  const { data: source, error: sourceError } = await auth.supabase
    .from("agents")
    .select("name, description, icon, system_prompt, provider, model, tools")
    .eq("id", agentId)
    .maybeSingle();
  if (sourceError || !source) {
    return NextResponse.json({ error: "Agent not found" }, { status: 404 });
  }

  const { data, error } = await auth.supabase
    .from("agents")
    .insert({
      owner_id: auth.userId,
      name: `${source.name} (copy)`,
      description: source.description,
      icon: source.icon,
      system_prompt: source.system_prompt,
      provider: source.provider,
      model: source.model,
      tools: source.tools,
      visibility: "private",
      forked_from: agentId,
    })
    .select("*")
    .single();
  if (error || !data) {
    return NextResponse.json(
      { error: error?.message ?? "Failed to clone agent" },
      { status: 500 }
    );
  }

  return NextResponse.json({ agent: data }, { status: 201 });
}
