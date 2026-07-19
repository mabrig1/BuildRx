import { NextResponse } from "next/server";

import { requireTeamUser } from "@/lib/teams/access";
import { createTeamSchema } from "@/lib/validations/teams";

/**
 * GET /api/teams — teams the caller belongs to (owned or member),
 * newest first. RLS alone determines visibility.
 *
 * POST /api/teams — create a team and add the caller as its owner.
 */
export async function GET() {
  const auth = await requireTeamUser();
  if (!auth.ok) return auth.response;

  const { data, error } = await auth.supabase
    .from("teams")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ teams: data });
}

export async function POST(request: Request) {
  const auth = await requireTeamUser();
  if (!auth.ok) return auth.response;

  const body = await request.json().catch(() => null);
  const parsed = createTeamSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid request" },
      { status: 400 }
    );
  }

  const team = await auth.supabase
    .from("teams")
    .insert({ owner_id: auth.userId, name: parsed.data.name })
    .select("*")
    .single();
  if (team.error || !team.data) {
    return NextResponse.json(
      { error: team.error?.message ?? "Failed to create team" },
      { status: 500 }
    );
  }

  const membership = await auth.supabase
    .from("team_members")
    .insert({ team_id: team.data.id, user_id: auth.userId, role: "owner" });
  if (membership.error) {
    // Compensate — a team with no owner membership row is unreachable (RLS-invisible) and orphaned.
    await auth.supabase.from("teams").delete().eq("id", team.data.id);
    return NextResponse.json(
      { error: `Failed to create team: ${membership.error.message}` },
      { status: 500 }
    );
  }

  return NextResponse.json({ team: team.data }, { status: 201 });
}
