import { NextResponse } from "next/server";

import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";
import { shareProjectSchema } from "@/lib/validations/teams";

type RouteParams = { params: Promise<{ projectId: string }> };

/**
 * PATCH /api/projects/[projectId]/share — share a project with a team
 * (`teamId`) or unshare it (`teamId: null`). Only the project's owner
 * can call this — RLS additionally restricts team members to editing
 * an *already*-shared project, never the initial share/unshare (see
 * the "Team members can update team projects" policy comment in
 * 20260719000800_teams.sql), so this route deliberately doesn't add
 * its own ownership check on top of that.
 */
export async function PATCH(request: Request, { params }: RouteParams) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json(
      { error: "Sharing requires Supabase to be configured on this deployment." },
      { status: 503 }
    );
  }
  const { projectId } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const parsed = shareProjectSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid request" },
      { status: 400 }
    );
  }

  if (parsed.data.teamId) {
    const membership = await supabase
      .from("team_members")
      .select("team_id")
      .eq("team_id", parsed.data.teamId)
      .eq("user_id", user.id)
      .maybeSingle();
    if (!membership.data) {
      return NextResponse.json({ error: "You're not a member of that team." }, { status: 403 });
    }
  }

  const { data, error } = await supabase
    .from("projects")
    .update({ team_id: parsed.data.teamId })
    .eq("id", projectId)
    .select("id, team_id")
    .single();
  if (error || !data) {
    return NextResponse.json(
      { error: error?.message ?? "Project not found, or you don't have permission to share it" },
      { status: 404 }
    );
  }

  return NextResponse.json({ project: data });
}
