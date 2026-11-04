import { NextResponse } from "next/server";
import { z } from "zod";

import { GitHubApiError, GitHubClient } from "@/lib/github/client";
import { getConnection, getSession } from "@/lib/github/service";
import { createClient } from "@/lib/supabase/server";

const schema = z.string().uuid();

/**
 * Checks the most recent GitHub Cloudflare Build checks. This is a read-only
 * status check, not an API to deploy a Worker or infer a workers.dev hostname.
 */
export async function GET(request: Request) {
  const session = await getSession();
  if (!session || session.demo || !session.userId) {
    return NextResponse.json({ error: "Sign in to check your app launch." }, { status: 401 });
  }
  const projectId = new URL(request.url).searchParams.get("projectId");
  const parsed = schema.safeParse(projectId);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid app ID." }, { status: 400 });
  }

  const supabase = await createClient();
  const { data: project, error } = await supabase
    .from("projects")
    .select("github_repo")
    .eq("id", parsed.data)
    .eq("owner_id", session.userId)
    .maybeSingle();
  if (error) {
    return NextResponse.json({ error: "Unable to verify app ownership." }, { status: 503 });
  }
  if (!project) {
    return NextResponse.json({ error: "App not found." }, { status: 404 });
  }
  if (!project.github_repo) {
    return NextResponse.json({
      state: "not_connected",
      message: "Prepare the app for Cloudflare before checking its launch.",
      checkCount: 0,
    }, { headers: { "Cache-Control": "no-store" } });
  }

  const connection = await getConnection();
  if (!connection) {
    return NextResponse.json({
      state: "unknown",
      message: "Connect GitHub to see Cloudflare's build updates.",
      checkCount: 0,
    }, { headers: { "Cache-Control": "no-store" } });
  }
  try {
    const client = new GitHubClient(connection.token);
    const repo = await client.getRepo(project.github_repo);
    const check = await client.getCloudflareBuildCheck(
      repo.fullName,
      repo.defaultBranch
    );
    return NextResponse.json({
      ...check,
      message:
        check.state === "passed"
          ? "Cloudflare build checks passed. Open Cloudflare to obtain and test your public link."
          : check.state === "building"
            ? "Cloudflare is building your app. Refresh to see the latest checks."
            : check.state === "failed"
              ? "The Cloudflare build failed. Open its build details to see what needs fixing."
              : check.state === "not_connected"
                ? "Cloudflare has not reported a build for this commit. Check that this app repository is connected in Workers Builds."
                : "Cloudflare's build result is not yet verified.",
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    if (err instanceof GitHubApiError && (err.status === 403 || err.status === 401)) {
      return NextResponse.json({
        state: "unknown",
        checkCount: 0,
        message: "GitHub has not granted access to build checks. Check the GitHub connection permissions or open Cloudflare directly.",
      }, { headers: { "Cache-Control": "no-store" } });
    }
    return NextResponse.json({
      error: "Unable to retrieve Cloudflare build checks. Try again or open your Cloudflare dashboard.",
    }, { status: 502, headers: { "Cache-Control": "no-store" } });
  }
}
