import { NextResponse } from "next/server";

import { requireTeamUser } from "@/lib/teams/access";
import { updateTeamSchema } from "@/lib/validations/teams";

type RouteParams = { params: Promise<{ teamId: string }> };

/**
 * GET /api/teams/[teamId] — the team plus its member roster (with
 * name/email/avatar — visible to teammates via the additive users RLS
 * policy from 20260719000900_team_profile_visibility.sql).
 *
 * PATCH — rename (owner only, RLS-enforced). DELETE — remove the team
 * (owner only; cascades to members/invites, and unlinks any shared
 * projects via team_id ON DELETE SET NULL).
 */
export async function GET(_request: Request, { params }: RouteParams) {
  const auth = await requireTeamUser();
  if (!auth.ok) return auth.response;
  const { teamId } = await params;

  const team = await auth.supabase.from("teams").select("*").eq("id", teamId).maybeSingle();
  if (!team.data) {
    return NextResponse.json({ error: "Team not found" }, { status: 404 });
  }

  const { data: members, error } = await auth.supabase
    .from("team_members")
    .select("id, user_id, role, created_at, users:user_id (name, email, avatar_url)")
    .eq("team_id", teamId)
    .order("created_at", { ascending: true });
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ team: team.data, members });
}

export async function PATCH(request: Request, { params }: RouteParams) {
  const auth = await requireTeamUser();
  if (!auth.ok) return auth.response;
  const { teamId } = await params;

  const body = await request.json().catch(() => null);
  const parsed = updateTeamSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid request" },
      { status: 400 }
    );
  }

  const { data, error } = await auth.supabase
    .from("teams")
    .update({ name: parsed.data.name })
    .eq("id", teamId)
    .select("*")
    .single();
  if (error || !data) {
    return NextResponse.json(
      { error: error?.message ?? "Team not found, or you're not its owner" },
      { status: 404 }
    );
  }

  return NextResponse.json({ team: data });
}

export async function DELETE(_request: Request, { params }: RouteParams) {
  const auth = await requireTeamUser();
  if (!auth.ok) return auth.response;
  const { teamId } = await params;

  const { data, error } = await auth.supabase
    .from("teams")
    .delete()
    .eq("id", teamId)
    .select("id")
    .maybeSingle();
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json(
      { error: "Team not found, or you're not its owner" },
      { status: 404 }
    );
  }

  return NextResponse.json({ success: true });
}
