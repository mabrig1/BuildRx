import { NextResponse } from "next/server";

import { requireAgentUser } from "@/lib/ai-agents/access";

/**
 * GET /api/agents/marketplace — public agents anyone signed in can
 * browse and clone, newest first. Capped at 50; no pagination yet.
 */
export async function GET() {
  const auth = await requireAgentUser();
  if (!auth.ok) return auth.response;

  const { data, error } = await auth.supabase
    .from("agents")
    .select("id, owner_id, name, description, icon, provider, model, tools, created_at")
    .eq("visibility", "public")
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ agents: data });
}
