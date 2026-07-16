import { GitHubClient, type GitHubCommit } from "@/lib/github/client";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";

/**
 * GitHub connection plumbing shared by the /api/github routes, plus an
 * in-memory simulation used in demo mode (no Supabase) so the whole
 * flow is clickable before any keys are configured.
 */

export interface SessionInfo {
  userId: string | null;
  demo: boolean;
}

export async function getSession(): Promise<SessionInfo | null> {
  if (!isSupabaseConfigured()) {
    return { userId: null, demo: true };
  }
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  return { userId: user.id, demo: false };
}

export async function getConnection(): Promise<{
  token: string;
  accountName: string | null;
} | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("integration_connections")
    .select("access_token, account_name")
    .eq("provider", "github")
    .maybeSingle();
  return data
    ? { token: data.access_token, accountName: data.account_name }
    : null;
}

export function githubClientFor(token: string) {
  return new GitHubClient(token);
}

// ------------------------------------------------------------------
// Demo simulation (no Supabase configured)
// ------------------------------------------------------------------

interface DemoState {
  connected: boolean;
  username: string;
  repos: Map<string, { fullName: string; commits: GitHubCommit[] }>;
}

const globalDemo = globalThis as unknown as { __appCreatorGithub?: DemoState };

export function demoState(): DemoState {
  globalDemo.__appCreatorGithub ??= {
    connected: false,
    username: "demo-user",
    repos: new Map(),
  };
  return globalDemo.__appCreatorGithub;
}

export function demoCommit(message: string, fileCount: number): GitHubCommit {
  const sha = Array.from({ length: 40 }, () =>
    "0123456789abcdef".charAt(Math.floor(Math.random() * 16))
  ).join("");
  return {
    sha,
    message: `${message} (${fileCount} files)`,
    author: "demo-user",
    date: new Date().toISOString(),
    url: `https://github.com/demo-user/repo/commit/${sha}`,
  };
}
