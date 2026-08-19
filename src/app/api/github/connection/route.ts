import { NextResponse } from "next/server";
import { z } from "zod";

import { GitHubApiError, GitHubClient } from "@/lib/github/client";
import { demoState, getConnection, getSession } from "@/lib/github/service";
import { createClient } from "@/lib/supabase/server";

/** GET — connection status (+ linked repo when ?projectId= given). */
export async function GET(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const projectId = searchParams.get("projectId");

  if (session.demo) {
    const state = demoState();
    return NextResponse.json({
      connected: state.connected,
      username: state.connected ? state.username : null,
      repo: projectId
        ? (state.repos.get(projectId)?.fullName ?? null)
        : null,
      simulated: true,
    });
  }

  const connection = await getConnection();
  let repo: string | null = null;
  if (projectId && connection) {
    const supabase = await createClient();
    const { data: project } = await supabase
      .from("projects")
      .select("github_repo")
      .eq("id", projectId)
      .maybeSingle();
    repo = project?.github_repo ?? null;
  }
  return NextResponse.json({
    connected: Boolean(connection),
    username: connection?.accountName ?? null,
    repo,
    simulated: false,
  });
}

const connectSchema = z.object({
  token: z.string().min(8).max(255),
});

/** POST — connect a GitHub account with a personal access token. */
export async function POST(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const parsed = connectSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Enter a valid personal access token." },
      { status: 400 }
    );
  }

  if (session.demo) {
    const state = demoState();
    state.connected = true;
    return NextResponse.json({
      connected: true,
      username: state.username,
      simulated: true,
    });
  }

  try {
    const user = await new GitHubClient(parsed.data.token).getUser();
    const supabase = await createClient();
    const { error } = await supabase.from("integration_connections").upsert(
      {
        user_id: session.userId!,
        provider: "github",
        access_token: parsed.data.token,
        account_name: user.login,
      },
      { onConflict: "user_id,provider" }
    );
    if (error) throw new Error(error.message);
    return NextResponse.json({ connected: true, username: user.login });
  } catch (error) {
    const status = error instanceof GitHubApiError ? error.status : 500;
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to connect GitHub",
      },
      { status: status === 401 ? 400 : 502 }
    );
  }
}

/** DELETE — disconnect. */
export async function DELETE() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (session.demo) {
    demoState().connected = false;
    return NextResponse.json({ connected: false, simulated: true });
  }

  const supabase = await createClient();
  await supabase
    .from("integration_connections")
    .delete()
    .eq("provider", "github");
  return NextResponse.json({ connected: false });
}
