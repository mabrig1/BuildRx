import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { AgentForm } from "@/components/agents/agent-form";
import { PageHeader } from "@/components/layout/page-header";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "New agent" };

export default async function NewAgentPage() {
  if (isSupabaseConfigured()) {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) redirect("/login?next=/agents/new");
  }

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <PageHeader
        title="New agent"
        description="Give it a purpose, a system prompt, and the tools it needs."
      />
      <AgentForm />
    </div>
  );
}
