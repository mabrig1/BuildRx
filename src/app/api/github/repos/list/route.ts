import { NextResponse } from "next/server";

import { GitHubApiError, GitHubClient } from "@/lib/github/client";
import { demoState, getConnection, getSession } from "@/lib/github/service";

/**
 * GET /api/github/repos/list — the connected account's own repos, for
 * the "import an existing repo" picker (previously the only way to
 * link an existing repo was typing `owner/name` blind).
 */
export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (session.demo) {
    const state = demoState();
    if (!state.connected) {
      return NextResponse.json(
        { error: "Connect your GitHub account first." },
        { status: 400 }
      );
    }
    return NextResponse.json({
      repos: [
        {
          fullName: `${state.username}/example-app`,
          htmlUrl: `https://github.com/${state.username}/example-app`,
          defaultBranch: "main",
          private: false,
        },
      ],
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

  try {
    const repos = await new GitHubClient(connection.token).listRepos();
    return NextResponse.json({ repos });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to list repositories" },
      { status: error instanceof GitHubApiError ? error.status : 502 }
    );
  }
}
