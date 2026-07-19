import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { ConnectSupabaseNotice } from "@/components/dashboard/connect-supabase-notice";
import { PageHeader } from "@/components/layout/page-header";
import { CreateTeamDialog } from "@/components/teams/create-team-dialog";
import { TeamCard, type TeamSummary } from "@/components/teams/team-card";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Teams" };

async function loadTeams(): Promise<{ teams: TeamSummary[]; userId: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/teams");

  const { data } = await supabase
    .from("teams")
    .select("id, name, owner_id, created_at")
    .order("created_at", { ascending: false });

  return { teams: data ?? [], userId: user.id };
}

export default async function TeamsPage() {
  const configured = isSupabaseConfigured();
  const { teams, userId } = configured
    ? await loadTeams()
    : { teams: [] as TeamSummary[], userId: "" };

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
      <PageHeader title="Teams" description="Collaborate on shared projects with role-based access.">
        <CreateTeamDialog />
      </PageHeader>

      {!configured ? <ConnectSupabaseNotice /> : null}

      {configured && teams.length === 0 ? (
        <div className="text-muted-foreground rounded-lg border border-dashed py-16 text-center text-sm">
          No teams yet — create one to start collaborating.
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {teams.map((team) => (
            <TeamCard key={team.id} team={team} currentUserId={userId} />
          ))}
        </div>
      )}
    </div>
  );
}
