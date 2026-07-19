import { NextResponse } from "next/server";

import { requireTeamUser } from "@/lib/teams/access";
import { createInviteSchema } from "@/lib/validations/teams";

type RouteParams = { params: Promise<{ teamId: string }> };

/**
 * GET /api/teams/[teamId]/invites — pending/past invites for this
 * team (owner/admin only via RLS — a plain member sees an empty list,
 * not an error).
 *
 * POST — create an invite (owner/admin only). There's no email-sending
 * infrastructure in this deployment, so the response includes a
 * shareable accept link for the inviter to send however they like.
 */
export async function GET(_request: Request, { params }: RouteParams) {
  const auth = await requireTeamUser();
  if (!auth.ok) return auth.response;
  const { teamId } = await params;

  const { data, error } = await auth.supabase
    .from("team_invites")
    .select("*")
    .eq("team_id", teamId)
    .order("created_at", { ascending: false });
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ invites: data });
}

export async function POST(request: Request, { params }: RouteParams) {
  const auth = await requireTeamUser();
  if (!auth.ok) return auth.response;
  const { teamId } = await params;

  const body = await request.json().catch(() => null);
  const parsed = createInviteSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid request" },
      { status: 400 }
    );
  }

  const { data, error } = await auth.supabase
    .from("team_invites")
    .insert({
      team_id: teamId,
      email: parsed.data.email,
      role: parsed.data.role,
      invited_by: auth.userId,
    })
    .select("*")
    .single();
  if (error || !data) {
    return NextResponse.json(
      { error: error?.message ?? "Failed to create invite (are you an owner or admin of this team?)" },
      { status: 403 }
    );
  }

  const origin = new URL(request.url).origin;
  return NextResponse.json(
    { invite: data, acceptUrl: `${origin}/teams/invite/${data.token}` },
    { status: 201 }
  );
}
