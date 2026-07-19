import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { MarketplaceGrid, type MarketplaceAgent } from "@/components/agents/marketplace-grid";
import { ConnectSupabaseNotice } from "@/components/dashboard/connect-supabase-notice";
import { PageHeader } from "@/components/layout/page-header";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Agent marketplace" };

async function loadPublicAgents(): Promise<MarketplaceAgent[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/agents/marketplace");

  const { data } = await supabase
    .from("agents")
    .select("id, name, description, icon, provider, model, tools")
    .eq("visibility", "public")
    .order("created_at", { ascending: false })
    .limit(50);

  return (data ?? []).map((row) => ({
    id: row.id,
    name: row.name,
    description: row.description,
    icon: row.icon,
    provider: row.provider,
    model: row.model,
    tools: Array.isArray(row.tools) ? (row.tools as string[]) : [],
  }));
}

export default async function AgentMarketplacePage() {
  const configured = isSupabaseConfigured();
  const agents = configured ? await loadPublicAgents() : [];

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
      <PageHeader
        title="Agent marketplace"
        description="Public agents shared by the community — clone one to make it your own."
      />

      {!configured ? <ConnectSupabaseNotice /> : null}

      {configured && agents.length === 0 ? (
        <div className="text-muted-foreground rounded-lg border border-dashed py-16 text-center text-sm">
          No public agents yet — be the first to publish one.
        </div>
      ) : (
        <MarketplaceGrid agents={agents} />
      )}
    </div>
  );
}
