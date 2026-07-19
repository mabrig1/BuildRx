import { NextResponse } from "next/server";

import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

type RouteParams = { params: Promise<{ token: string }> };

/**
 * GET /api/teams/invites/[token] — invite details for the accept page
 * (team name, invited email, role, whether it's still valid). No auth
 * required to view — the token itself is the credential, and nothing
 * sensitive is exposed. Uses the service-role client since the
 * invited user isn't a team member yet, so the normal owner/admin-only
 * RLS on team_invites wouldn't let them see it.
 */
export async function GET(_request: Request, { params }: RouteParams) {
  if (!isSupabaseConfigured() || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json(
      { error: "Teams require Supabase to be configured on this deployment." },
      { status: 503 }
    );
  }
  const { token } = await params;
  const admin = createAdminClient();

  const invite = await admin
    .from("team_invites")
    .select("id, email, role, status, expires_at, team_id, teams:team_id (name)")
    .eq("token", token)
    .maybeSingle();
  if (!invite.data) {
    return NextResponse.json({ error: "Invite not found" }, { status: 404 });
  }

  const valid = invite.data.status === "pending" && new Date(invite.data.expires_at) > new Date();
  return NextResponse.json({
    invite: {
      email: invite.data.email,
      role: invite.data.role,
      status: invite.data.status,
      valid,
      teamName: invite.data.teams?.name ?? "this team",
    },
  });
}

/**
 * POST /api/teams/invites/[token] — accept the invite. Requires
 * sign-in; the signed-in user's email must match the invite's email
 * (case-insensitively) — enforced both here and by the
 * team_members insert RLS policy itself.
 */
export async function POST(_request: Request, { params }: RouteParams) {
  if (!isSupabaseConfigured() || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json(
      { error: "Teams require Supabase to be configured on this deployment." },
      { status: 503 }
    );
  }
  const { token } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Sign in to accept this invite." }, { status: 401 });
  }

  const admin = createAdminClient();
  const invite = await admin
    .from("team_invites")
    .select("*")
    .eq("token", token)
    .maybeSingle();
  if (!invite.data) {
    return NextResponse.json({ error: "Invite not found" }, { status: 404 });
  }
  if (invite.data.status !== "pending" || new Date(invite.data.expires_at) <= new Date()) {
    return NextResponse.json({ error: "This invite is no longer valid." }, { status: 410 });
  }
  if ((user.email ?? "").toLowerCase() !== invite.data.email.toLowerCase()) {
    return NextResponse.json(
      { error: `This invite was sent to ${invite.data.email} — sign in with that email to accept it.` },
      { status: 403 }
    );
  }

  // Insert via the user's own RLS-scoped client — the "join via pending
  // invite" policy re-verifies the same email match server-side.
  const membership = await supabase
    .from("team_members")
    .insert({ team_id: invite.data.team_id, user_id: user.id, role: invite.data.role })
    .select("team_id")
    .single();
  if (membership.error || !membership.data) {
    return NextResponse.json(
      { error: membership.error?.message ?? "Failed to join the team" },
      { status: 400 }
    );
  }

  await admin.from("team_invites").update({ status: "accepted" }).eq("id", invite.data.id);

  return NextResponse.json({ teamId: membership.data.team_id });
}
