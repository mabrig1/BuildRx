import { NextResponse } from "next/server";
import { z } from "zod";

import { prepareCloudflareSource } from "@/lib/deploy/cloudflare";
import { DeployError } from "@/lib/deploy/providers";
import { isDeploymentSourcePath } from "@/lib/deploy/source";
import { getFileSystem } from "@/lib/files/manager";
import { GitHubApiError, GitHubClient } from "@/lib/github/client";
import { getConnection, getSession } from "@/lib/github/service";
import { createClient } from "@/lib/supabase/server";

export const maxDuration = 120;

const schema = z.object({ projectId: z.string().uuid() });

/**
 * POST /api/deploy/cloudflare/prepare
 *
 * This is a source-to-GitHub handoff, NOT a claim of Cloudflare deployment.
 * The repository receives an opt-in workflow and Workers build config.
 * Neither a Cloudflare credential nor a guessed workers.dev URL is returned.
 */
export async function POST(request: Request) {
  const session = await getSession();
  if (!session || session.demo || !session.userId) {
    return NextResponse.json(
      { error: "Sign in and connect persistent project storage and GitHub to prepare a real deployment. Temporary demo apps cannot be published." },
      { status: 401 }
    );
  }
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid project ID." }, { status: 400 });
  }

  const supabase = await createClient();
  const { data: project, error: queryError } = await supabase
    .from("projects")
    .select("name, status, github_repo")
    .eq("id", parsed.data.projectId)
    .eq("owner_id", session.userId)
    .maybeSingle();
  if (queryError) return NextResponse.json({ error: "Unable to verify project ownership." }, { status: 503 });
  if (!project) return NextResponse.json({ error: "Project not found." }, { status: 404 });
  if (project.status !== "ready") {
    return NextResponse.json({ error: "This project has not passed its build checks. Repair and verify the project before deploying." }, { status: 409 });
  }
  if (!project.github_repo || !/^[a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+$/.test(project.github_repo)) {
    return NextResponse.json({ error: "Link a GitHub repository in the GitHub panel first." }, { status: 400 });
  }
  const connection = await getConnection();
  if (!connection) {
    return NextResponse.json({ error: "Connect GitHub in the workspace first." }, { status: 400 });
  }

  try {
    const fs = getFileSystem(parsed.data.projectId);
    const entries = await fs.list();
    const source = (await Promise.all(
      entries
        .filter(entry => isDeploymentSourcePath(entry.path) && !entry.path.startsWith(".github/"))
        .map(entry => fs.read(entry.path))
    ))
      .filter((file): file is NonNullable<typeof file> => file !== null)
      .map(({ path, content }) => ({ path, content }));
    const prepared = prepareCloudflareSource(source, project.name);
    const client = new GitHubClient(connection.token);
    const repository = await client.getRepo(project.github_repo);
    const pushed = await client.pushFiles(
      repository.fullName, prepared.files,
      "chore: prepare app for Cloudflare Workers deployment",
      repository.defaultBranch
    );

    return NextResponse.json({
      prepared: true,
      deployed: false,
      workerName: prepared.workerName,
      repositoryUrl: repository.htmlUrl,
      commitUrl: pushed.commitUrl,
      workflowUrl: `${repository.htmlUrl}/actions/workflows/cloudflare-deploy.yml`,
      secretsUrl: `${repository.htmlUrl}/settings/secrets/actions`,
      dashboardUrl: "https://dash.cloudflare.com/",
      instructions: [
        "Your Next.js source and Cloudflare configuration are now in GitHub.",
        "Option A: connect this repository to Cloudflare Workers Builds; build with npm run cloudflare:build and deploy with npm run cloudflare:publish.",
        "Option B: add CLOUDFLARE_API_TOKEN and CLOUDFLARE_ACCOUNT_ID as GitHub Actions secrets, then use Run workflow.",
        "Verify deployment and configure app/database secrets in Cloudflare before serving customers.",
      ],
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to prepare Cloudflare deployment.";
    return NextResponse.json({ error: message }, {
      status: error instanceof DeployError ? 400 : error instanceof GitHubApiError ? 502 : 500,
    });
  }
}
