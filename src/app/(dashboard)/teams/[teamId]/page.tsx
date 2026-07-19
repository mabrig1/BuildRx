import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

import { PageHeader } from "@/components/layout/page-header";
import { InviteDialog } from "@/components/teams/invite-dialog";
import { TeamHeaderActions } from "@/components/teams/team-header-actions";
import { TeamInvitesPanel, type TeamInviteRow } from "@/components/teams/team-invites-panel";
import { TeamMembersPanel, type TeamMemberRow } from "@/components/teams/team-members-panel";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";

type RouteParams = { params: Promise<{ teamId: string }> };

export async function generateMetadata({ params }: RouteParams): Promise<Metadata> {
  const { teamId } = await params;
  return { title: `Team · ${teamId}` };
}

export default async function TeamPage({ params }: RouteParams) {
  const { teamId } = await params;

  if (!isSupabaseConfigured()) notFound();

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=/teams/${teamId}`);

  const { data: team } = await supabase.from("teams").select("*").eq("id", teamId).maybeSingle();
  if (!team) notFound();

  const { data: members } = await supabase
    .from("team_members")
    .select("id, user_id, role, users:user_id (name, email, avatar_url)")
    .eq("team_id", teamId)
    .order("created_at", { ascending: true });

  const memberRows = (members ?? []) as unknown as TeamMemberRow[];
  const isOwner = team.owner_id === user.id;
  const myRole = memberRows.find((m) => m.user_id === user.id)?.role;
  const canManage = isOwner || myRole === "admin";

  const invites: TeamInviteRow[] = canManage
    ? ((
        await supabase
          .from("team_invites")
          .select("id, email, role, status, created_at")
          .eq("team_id", teamId)
          .order("created_at", { ascending: false })
      ).data ?? [])
    : [];

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
      <PageHeader title={team.name} description={`${memberRows.length} member${memberRows.length === 1 ? "" : "s"}`}>
        <TeamHeaderActions teamId={teamId} initialName={team.name} isOwner={isOwner} />
      </PageHeader>

      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Members</h2>
          {canManage ? <InviteDialog teamId={teamId} /> : null}
        </div>
        <TeamMembersPanel
          teamId={teamId}
          members={memberRows}
          currentUserId={user.id}
          canManage={canManage}
        />
      </div>

      {canManage ? (
        <div className="flex flex-col gap-3">
          <h2 className="text-lg font-semibold">Pending invites</h2>
          <TeamInvitesPanel teamId={teamId} invites={invites} />
        </div>
      ) : null}
    </div>
  );
}
