import { NextResponse } from "next/server";
import { z } from "zod";

import { GitHubApiError, GitHubClient } from "@/lib/github/client";
import { demoState, getConnection, getSession } from "@/lib/github/service";
import { createClient } from "@/lib/supabase/server";

const createSchema = z.object({
  projectId: z.string().min(1).max(100),
  name: z
    .string()
    .min(1)
    .max(100)
    .regex(/^[A-Za-z0-9._-]+$/, "Invalid repository name"),
  isPrivate: z.boolean().default(true),
  description: z.string().max(300).optional(),
});

/** POST — create a repository and link it to the project. */
export async function POST(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid request" },
      { status: 400 }
    );
  }
  const { projectId, name, isPrivate, description } = parsed.data;

  if (session.demo) {
    const state = demoState();
    if (!state.connected) {
      return NextResponse.json(
        { error: "Connect your GitHub account first." },
        { status: 400 }
      );
    }
    const fullName = `${state.username}/${name}`;
    state.repos.set(projectId, { fullName, commits: [] });
    return NextResponse.json({
      repo: fullName,
      url: `https://github.com/${fullName}`,
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
    const repo = await new GitHubClient(connection.token).createRepo(name, {
      isPrivate,
      description,
    });
    const supabase = await createClient();
    const { error } = await supabase
      .from("projects")
      .update({ github_repo: repo.fullName })
      .eq("id", projectId);
    if (error) throw new Error(error.message);
    return NextResponse.json({ repo: repo.fullName, url: repo.htmlUrl });
  } catch (error) {
    const status = error instanceof GitHubApiError ? error.status : 502;
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to create repository",
      },
      { status: status >= 500 ? 502 : status }
    );
  }
}

const linkSchema = z.object({
  projectId: z.string().min(1).max(100),
  fullName: z
    .string()
    .regex(/^[A-Za-z0-9._-]+\/[A-Za-z0-9._-]+$/, "Use the owner/name format"),
});

/** PUT — link an existing repository to the project. */
export async function PUT(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const parsed = linkSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid request" },
      { status: 400 }
    );
  }
  const { projectId, fullName } = parsed.data;

  if (session.demo) {
    const state = demoState();
    if (!state.connected) {
      return NextResponse.json(
        { error: "Connect your GitHub account first." },
        { status: 400 }
      );
    }
    state.repos.set(projectId, { fullName, commits: [] });
    return NextResponse.json({ repo: fullName, simulated: true });
  }

  const connection = await getConnection();
  if (!connection) {
    return NextResponse.json(
      { error: "Connect your GitHub account first." },
      { status: 400 }
    );
  }

  try {
    const repo = await new GitHubClient(connection.token).getRepo(fullName);
    const supabase = await createClient();
    const { error } = await supabase
      .from("projects")
      .update({ github_repo: repo.fullName })
      .eq("id", projectId);
    if (error) throw new Error(error.message);
    return NextResponse.json({ repo: repo.fullName });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Repository not found",
      },
      { status: error instanceof GitHubApiError ? error.status : 502 }
    );
  }
}
