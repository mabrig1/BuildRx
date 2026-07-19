import { NextResponse } from "next/server";

import { requireAgentUser } from "@/lib/ai-agents/access";
import { createAgentSchema } from "@/lib/validations/agents";

/**
 * GET /api/agents — the signed-in user's own agents (owner + visibility
 * are both RLS-enforced, but this endpoint only ever returns your own).
 *
 * POST /api/agents — create an agent.
 */
export async function GET() {
  const auth = await requireAgentUser();
  if (!auth.ok) return auth.response;

  const { data, error } = await auth.supabase
    .from("agents")
    .select("*")
    .eq("owner_id", auth.userId)
    .order("updated_at", { ascending: false });
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ agents: data });
}

export async function POST(request: Request) {
  const auth = await requireAgentUser();
  if (!auth.ok) return auth.response;

  const body = await request.json().catch(() => null);
  const parsed = createAgentSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid request" },
      { status: 400 }
    );
  }
  const input = parsed.data;

  const { data, error } = await auth.supabase
    .from("agents")
    .insert({
      owner_id: auth.userId,
      name: input.name,
      description: input.description || null,
      icon: input.icon || "🤖",
      system_prompt: input.systemPrompt,
      provider: input.provider,
      model: input.model,
      tools: input.tools,
      visibility: input.visibility,
    })
    .select("*")
    .single();
  if (error || !data) {
    return NextResponse.json(
      { error: error?.message ?? "Failed to create agent" },
      { status: 500 }
    );
  }

  return NextResponse.json({ agent: data }, { status: 201 });
}
