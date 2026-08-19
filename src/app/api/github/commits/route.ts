import { NextResponse } from "next/server";

import { GitHubApiError, GitHubClient } from "@/lib/github/client";
import { demoState, getConnection, getSession } from "@/lib/github/service";
import { createClient } from "@/lib/supabase/server";

/** GET ?projectId= — commit history of the linked repository. */
export async function GET(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const projectId = searchParams.get("projectId");
  if (!projectId) {
    return NextResponse.json({ error: "projectId required" }, { status: 400 });
  }

  if (session.demo) {
    const repo = demoState().repos.get(projectId);
    return NextResponse.json({
      commits: repo?.commits ?? [],
      simulated: true,
    });
  }

  const connection = await getConnection();
  if (!connection) {
    return NextResponse.json({ commits: [] });
  }
  const supabase = await createClient();
  const { data: project } = await supabase
    .from("projects")
    .select("github_repo")
    .eq("id", projectId)
    .maybeSingle();
  if (!project?.github_repo) {
    return NextResponse.json({ commits: [] });
  }

  try {
    const client = new GitHubClient(connection.token);
    const repo = await client.getRepo(project.github_repo);
    const commits = await client.listCommits(
      repo.fullName,
      repo.defaultBranch
    );
    return NextResponse.json({ commits });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to load commits",
      },
      { status: error instanceof GitHubApiError ? 502 : 500 }
    );
  }
}
