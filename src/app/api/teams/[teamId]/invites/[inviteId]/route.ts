import { NextResponse } from "next/server";

import { requireTeamUser } from "@/lib/teams/access";

type RouteParams = { params: Promise<{ teamId: string; inviteId: string }> };

/** DELETE /api/teams/[teamId]/invites/[inviteId] — revoke a pending invite (owner/admin only). */
export async function DELETE(_request: Request, { params }: RouteParams) {
  const auth = await requireTeamUser();
  if (!auth.ok) return auth.response;
  const { teamId, inviteId } = await params;

  const { data, error } = await auth.supabase
    .from("team_invites")
    .delete()
    .eq("id", inviteId)
    .eq("team_id", teamId)
    .select("id")
    .maybeSingle();
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json(
      { error: "Invite not found, or you don't have permission to revoke it" },
      { status: 404 }
    );
  }

  return NextResponse.json({ success: true });
}
