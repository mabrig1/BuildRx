import { NextResponse } from "next/server";
import { z } from "zod";

import { getFileSystem } from "@/lib/files/manager";
import { fileWithEmbeddedCredential, isDeploymentSourcePath } from "@/lib/deploy/source";
import { GitHubApiError, GitHubClient } from "@/lib/github/client";
import {
  demoCommit,
  demoState,
  getConnection,
  getSession,
} from "@/lib/github/service";
import { createClient } from "@/lib/supabase/server";

export const maxDuration = 120;

const pushSchema = z.object({
  projectId: z.string().min(1).max(100),
  message: z.string().min(1).max(200).default("Update from App-Creator"),
});

/** POST — push/export the project's files to the linked repository. */
export async function POST(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const parsed = pushSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request" },
      { status: 400 }
    );
  }
  const { projectId, message } = parsed.data;

  if (!session.demo) {
    const supabase = await createClient();
    const { data: ownedProject, error } = await supabase.from("projects")
      .select("id").eq("id", projectId).eq("owner_id", session.userId!).maybeSingle();
    if (error) return NextResponse.json({ error: "Unable to verify app ownership." }, { status: 503 });
    if (!ownedProject) return NextResponse.json({ error: "App not found." }, { status: 404 });
  }

  const files = (await getFileSystem(projectId).list())
    .filter((file) => isDeploymentSourcePath(file.path));
  if (files.length === 0) {
    return NextResponse.json(
      { error: "No files to push — run a build first." },
      { status: 400 }
    );
  }

  if (session.demo) {
    const state = demoState();
    const repo = state.repos.get(projectId);
    if (!state.connected || !repo) {
      return NextResponse.json(
        { error: "Connect GitHub and create a repository first." },
        { status: 400 }
      );
    }
    const commit = demoCommit(message, files.length);
    repo.commits.unshift(commit);
    return NextResponse.json({
      commitSha: commit.sha,
      commitUrl: commit.url,
      fileCount: files.length,
      simulated: true,
    });
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
    .eq("owner_id", session.userId!)
    .maybeSingle();
  if (!project?.github_repo) {
    return NextResponse.json(
      { error: "Link or create a repository first." },
      { status: 400 }
    );
  }

  try {
    const fs = getFileSystem(projectId);
    const contents = await Promise.all(
      files.map(async ({ path }) => (await fs.read(path))!)
    );
    const credentialFile = fileWithEmbeddedCredential(contents);
    if (credentialFile) {
      return NextResponse.json({
        error: `Source file ${credentialFile} may contain a secret. Remove the value and use your hosting provider's encrypted settings instead.`,
      }, { status: 409 });
    }
    const client = new GitHubClient(connection.token);
    const repo = await client.getRepo(project.github_repo);
    const result = await client.pushFiles(
      repo.fullName,
      contents,
      message,
      repo.defaultBranch
    );
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Push failed" },
      { status: error instanceof GitHubApiError ? 502 : 500 }
    );
  }
}
