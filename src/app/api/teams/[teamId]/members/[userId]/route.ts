import { NextResponse } from "next/server";

import { requireTeamUser } from "@/lib/teams/access";
import { updateMemberRoleSchema } from "@/lib/validations/teams";

type RouteParams = { params: Promise<{ teamId: string; userId: string }> };

/**
 * PATCH /api/teams/[teamId]/members/[userId] — change a member's role
 * between admin/member (owner/admin only; the owner's own row can't be
 * touched here — RLS excludes it entirely).
 *
 * DELETE — remove a member (owner/admin only), or leave the team
 * yourself (any non-owner member, on their own row).
 */
export async function PATCH(request: Request, { params }: RouteParams) {
  const auth = await requireTeamUser();
  if (!auth.ok) return auth.response;
  const { teamId, userId } = await params;

  const body = await request.json().catch(() => null);
  const parsed = updateMemberRoleSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid request" },
      { status: 400 }
    );
  }

  const { data, error } = await auth.supabase
    .from("team_members")
    .update({ role: parsed.data.role })
    .eq("team_id", teamId)
    .eq("user_id", userId)
    .select("*")
    .single();
  if (error || !data) {
    return NextResponse.json(
      { error: error?.message ?? "Member not found, or you can't change their role" },
      { status: 404 }
    );
  }

  return NextResponse.json({ member: data });
}

export async function DELETE(_request: Request, { params }: RouteParams) {
  const auth = await requireTeamUser();
  if (!auth.ok) return auth.response;
  const { teamId, userId } = await params;

  const { data, error } = await auth.supabase
    .from("team_members")
    .delete()
    .eq("team_id", teamId)
    .eq("user_id", userId)
    .select("id")
    .maybeSingle();
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json(
      { error: "Member not found, or you don't have permission to remove them" },
      { status: 404 }
    );
  }

  return NextResponse.json({ success: true });
}
