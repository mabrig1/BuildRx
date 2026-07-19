import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Plus, Store } from "lucide-react";

import { AgentCard, type AgentSummary } from "@/components/agents/agent-card";
import { ConnectSupabaseNotice } from "@/components/dashboard/connect-supabase-notice";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Agents" };

async function loadAgents(): Promise<AgentSummary[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/agents");

  const { data } = await supabase
    .from("agents")
    .select("id, name, description, icon, provider, model, visibility, updated_at")
    .eq("owner_id", user.id)
    .order("updated_at", { ascending: false });

  return (data ?? []).map((row) => ({
    id: row.id,
    name: row.name,
    description: row.description,
    icon: row.icon,
    provider: row.provider,
    model: row.model,
    visibility: row.visibility,
    updatedAt: row.updated_at,
  }));
}

export default async function AgentsPage() {
  const configured = isSupabaseConfigured();
  const agents = configured ? await loadAgents() : [];

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
      <PageHeader
        title="Agents"
        description="Build custom AI assistants with their own prompt, tools, and memory."
      >
        <Button variant="outline" asChild>
          <Link href="/agents/marketplace">
            <Store />
            Marketplace
          </Link>
        </Button>
        <Button asChild>
          <Link href="/agents/new">
            <Plus />
            New agent
          </Link>
        </Button>
      </PageHeader>

      {!configured ? <ConnectSupabaseNotice /> : null}

      {configured && agents.length === 0 ? (
        <div className="text-muted-foreground rounded-lg border border-dashed py-16 text-center text-sm">
          No agents yet — create one to get started, or clone one from the
          marketplace.
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {agents.map((agent) => (
            <AgentCard key={agent.id} agent={agent} />
          ))}
        </div>
      )}
    </div>
  );
}
