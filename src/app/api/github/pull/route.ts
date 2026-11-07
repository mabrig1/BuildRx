import { NextResponse } from "next/server";
import { z } from "zod";

import { getFileSystem } from "@/lib/files/manager";
import { GitHubApiError, GitHubClient } from "@/lib/github/client";
import { demoState, getConnection, getSession } from "@/lib/github/service";
import { createClient } from "@/lib/supabase/server";
import { enforceDevShieldPreflight, DevShieldPreflightError, devShieldPublicEvidence } from "@/lib/security/devshield-preflight";

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
  const { data: project, error: projectError } = await supabase
    .from("projects")
    .select("github_repo")
    .eq("id", projectId)
    .eq("owner_id", session.userId!)
    .maybeSingle();
  if (projectError) {
    return NextResponse.json({ error: "Unable to verify project ownership." }, { status: 503 });
  }
  if (!project) {
    return NextResponse.json({ error: "Project not found." }, { status: 404 });
  }
  if (!project.github_repo) {
    return NextResponse.json({ error: "Link or create a repository first." }, { status: 400 });
  }

  try {
    const client = new GitHubClient(connection.token);
    const repo = await client.getRepo(project.github_repo);
    const files = await client.pullFiles(repo.fullName, repo.defaultBranch);
    // A repository read must never become a VFS write before DevShield reviews
    // the files. This does not execute or build anything from GitHub.
    const securityPreflight = enforceDevShieldPreflight(files);
    await getFileSystem(projectId).writeMany(files);
    return NextResponse.json({
      fileCount: files.length,
      securityPreflight: devShieldPublicEvidence(securityPreflight),
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof DevShieldPreflightError) {
      return NextResponse.json({
        error: error.message,
        securityPreflight: devShieldPublicEvidence(error.report),
      }, { status: 409, headers: { "Cache-Control": "no-store" } });
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Pull failed" },
      { status: error instanceof GitHubApiError ? 502 : 500 }
    );
  }
}
