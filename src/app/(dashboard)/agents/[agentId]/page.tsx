import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

import { AgentWorkspace, type AgentDetail } from "@/components/agents/agent-workspace";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";

type RouteParams = { params: Promise<{ agentId: string }> };

export async function generateMetadata({ params }: RouteParams): Promise<Metadata> {
  const { agentId } = await params;
  return { title: `Agent · ${agentId}` };
}

export default async function AgentPage({ params }: RouteParams) {
  const { agentId } = await params;

  if (!isSupabaseConfigured()) notFound();

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=/agents/${agentId}`);

  const { data } = await supabase
    .from("agents")
    .select("*")
    .eq("id", agentId)
    .maybeSingle();
  if (!data) notFound();

  const agent: AgentDetail = {
    id: data.id,
    owner_id: data.owner_id,
    name: data.name,
    description: data.description,
    icon: data.icon,
    system_prompt: data.system_prompt,
    provider: data.provider,
    model: data.model,
    tools: Array.isArray(data.tools) ? (data.tools as string[]) : [],
    visibility: data.visibility,
    share_slug: data.share_slug,
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      <AgentWorkspace agent={agent} isOwner={agent.owner_id === user.id} />
    </div>
  );
}
