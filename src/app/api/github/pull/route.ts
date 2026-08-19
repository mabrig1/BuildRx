import { NextResponse } from "next/server";
import { z } from "zod";

import { getFileSystem } from "@/lib/files/manager";
import { GitHubApiError, GitHubClient } from "@/lib/github/client";
import { demoState, getConnection, getSession } from "@/lib/github/service";
import { createClient } from "@/lib/supabase/server";

export const maxDuration = 120;

const pullSchema = z.object({
  projectId: z.string().min(1).max(100),
});

/** POST — pull the linked repository's files into the project VFS. */
export async function POST(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const parsed = pullSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
  const { projectId } = parsed.data;

  if (session.demo) {
    const state = demoState();
    const repo = state.repos.get(projectId);
    if (!state.connected || !repo) {
      return NextResponse.json(
        { error: "Connect GitHub and create a repository first." },
        { status: 400 }
      );
    }
    // Demo: the in-memory VFS is already the source of truth.
    const files = await getFileSystem(projectId).list();
    return NextResponse.json({ fileCount: files.length, simulated: true });
  }

  const connection = await getConnection();
  if (!connection) {
    return NextResponse.json(
      { error: "Connect your GitHub account first." },
      { status: 400 }
    );
  }
  const supabase = await createClient();
  const { data: project } = await supabase
    .from("projects")
    .select("github_repo")
    .eq("id", projectId)
    .maybeSingle();
  if (!project?.github_repo) {
    return NextResponse.json(
      { error: "Link or create a repository first." },
      { status: 400 }
    );
  }

  try {
    const client = new GitHubClient(connection.token);
    const repo = await client.getRepo(project.github_repo);
    const files = await client.pullFiles(repo.fullName, repo.defaultBranch);
    if (files.length > 0) {
      await getFileSystem(projectId).writeMany(files);
    }
    return NextResponse.json({ fileCount: files.length });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Pull failed" },
      { status: error instanceof GitHubApiError ? 502 : 500 }
    );
  }
}
