import { appendFile, mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { createClient } from "@supabase/supabase-js";
import { MongoClient } from "mongodb";
import { afterAll, describe, expect, it } from "vitest";

import { checksPass, runStaticChecks } from "@/lib/agents/checks";
import { runWorkflow } from "@/lib/agents/orchestrator";
import type { AgentEvent, WorkflowContext } from "@/lib/agents/types";
import {
  createChatCompletion as createOpenRouterChatCompletion,
} from "@/lib/ai/openrouter";
import {
  createChatCompletion as createNvidiaChatCompletion,
} from "@/lib/ai/nvidia";

const generatedRoots: string[] = [];

const LIVE_PROMPT = `Build a secure project tracker for small engineering teams.

Pages:
- Home: project health, active milestones, and recent activity
- Projects: searchable owned projects with create, edit, archive, and detail flows
- Milestones: project milestones, due dates, status, and ownership
- Activity: project updates and audit-friendly notes
- Settings: account and workspace preferences

Components:
AppShell, ProjectTable, ProjectForm, MilestoneBoard, ActivityTimeline, SearchFilters, StatusBadge, EmptyState

Tables:
- projects (id, owner_id, name, status, created_at)
- milestones (id, owner_id, project_id, title, status, created_at)
- activities (id, owner_id, project_id, subject, status, created_at)

Use authenticated ownership, persistent CRUD, loading/error/empty/success states, and a Vercel-ready production build.
`;

type GeneratedFile = { path: string; content: string };

type GithubPush = {
  branch: string;
  commitSha: string;
};

type VercelDeployment = {
  id: string;
  url: string;
};

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing required live-certification credential: ${name}`);
  return value;
}

function optional(name: string): string | undefined {
  const value = process.env[name]?.trim();
  return value || undefined;
}

async function summary(line: string) {
  const file = process.env.GITHUB_STEP_SUMMARY;
  if (file) await appendFile(file, `${line}\n`, "utf8");
}

async function materialize(context: WorkflowContext): Promise<string> {
  const root = await mkdtemp(path.join(os.tmpdir(), "buildrx-live-cert-"));
  generatedRoots.push(root);

  for (const file of context.files.values()) {
    const target = path.join(root, file.path);
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, file.content, "utf8");
  }

  return root;
}

async function githubRequest(
  url: string,
  init: RequestInit = {}
): Promise<Response> {
  const token = required("GITHUB_TOKEN");
  const response = await fetch(url, {
    ...init,
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${token}`,
      "X-GitHub-Api-Version": "2022-11-28",
      ...(init.headers ?? {}),
    },
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`GitHub API ${response.status}: ${detail.slice(0, 1000)}`);
  }
  return response;
}

async function pushGeneratedAppToGithub(
  files: GeneratedFile[],
  runId: string
): Promise<GithubPush> {
  const repository = required("GITHUB_REPOSITORY");
  const branch = `live-cert/${runId}`;
  const [owner, repo] = repository.split("/");
  if (!owner || !repo) throw new Error(`Invalid GITHUB_REPOSITORY: ${repository}`);

  const treeEntries = await Promise.all(
    files.map(async (file) => {
      const blobResponse = await githubRequest(
        `https://api.github.com/repos/${owner}/${repo}/git/blobs`,
        {
          method: "POST",
          body: JSON.stringify({
            content: Buffer.from(file.content, "utf8").toString("base64"),
            encoding: "base64",
          }),
        }
      );
      const blob = (await blobResponse.json()) as { sha: string };
      return {
        path: file.path,
        mode: "100644",
        type: "blob",
        sha: blob.sha,
      };
    })
  );

  const treeResponse = await githubRequest(
    `https://api.github.com/repos/${owner}/${repo}/git/trees`,
    {
      method: "POST",
      body: JSON.stringify({ tree: treeEntries }),
    }
  );
  const tree = (await treeResponse.json()) as { sha: string };

  const commitResponse = await githubRequest(
    `https://api.github.com/repos/${owner}/${repo}/git/commits`,
    {
      method: "POST",
      body: JSON.stringify({
        message: `Live certification generated app ${runId} [skip ci]`,
        tree: tree.sha,
        parents: [required("GITHUB_SHA")],
      }),
    }
  );
  const commit = (await commitResponse.json()) as { sha: string };

  await githubRequest(
    `https://api.github.com/repos/${owner}/${repo}/git/refs`,
    {
      method: "POST",
      body: JSON.stringify({
        ref: `refs/heads/${branch}`,
        sha: commit.sha,
      }),
    }
  );

  const verifyResponse = await githubRequest(
    `https://api.github.com/repos/${owner}/${repo}/git/ref/heads/${branch.replaceAll("/", "%2F")}`
  );
  const verified = (await verifyResponse.json()) as {
    object?: { sha?: string };
  };
  expect(verified.object?.sha).toBe(commit.sha);

  return { branch, commitSha: commit.sha };
}

async function deleteGithubBranch(branch: string): Promise<void> {
  const repository = required("GITHUB_REPOSITORY");
  const [owner, repo] = repository.split("/");
  const response = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/git/refs/heads/${branch.replaceAll("/", "%2F")}`,
    {
      method: "DELETE",
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${required("GITHUB_TOKEN")}`,
        "X-GitHub-Api-Version": "2022-11-28",
      },
    }
  );
  if (!response.ok && response.status !== 404) {
    throw new Error(`Failed to delete temporary GitHub branch: ${response.status}`);
  }
}

async function vercelRequest(
  endpoint: string,
  init: RequestInit = {}
): Promise<Response> {
  const teamId = required("LIVE_CERT_VERCEL_TEAM_ID");
  const separator = endpoint.includes("?") ? "&" : "?";
  const response = await fetch(
    `https://api.vercel.com${endpoint}${separator}teamId=${encodeURIComponent(teamId)}`,
    {
      ...init,
      headers: {
        Authorization: `Bearer ${required("LIVE_CERT_VERCEL_TOKEN")}`,
        "Content-Type": "application/json",
        ...(init.headers ?? {}),
      },
    }
  );

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Vercel API ${response.status}: ${detail.slice(0, 1200)}`);
  }
  return response;
}

async function deployToVercel(
  files: GeneratedFile[],
  github: GithubPush,
  runId: string
): Promise<VercelDeployment> {
  const project = required("LIVE_CERT_VERCEL_PROJECT_ID");
  const response = await vercelRequest("/v13/deployments", {
    method: "POST",
    body: JSON.stringify({
      name: `buildrx-live-cert-${runId}`.slice(0, 52),
      project,
      files: files.map((file) => ({
        file: file.path,
        data: Buffer.from(file.content, "utf8").toString("base64"),
        encoding: "base64",
      })),
      gitMetadata: {
        remoteUrl: `https://github.com/${required("GITHUB_REPOSITORY")}`,
        commitMessage: `BuildRx live certification ${runId}`,
        commitRef: github.branch,
        commitSha: github.commitSha,
        ci: "true",
        ciType: "github-actions",
      },
      projectSettings: {
        framework: "nextjs",
        nodeVersion: "22.x",
        installCommand: "npm install",
        buildCommand: "npm run build",
        skipGitConnectDuringLink: "true",
      },
    }),
  });

  const created = (await response.json()) as {
    id?: string;
    uid?: string;
    url?: string;
  };
  const id = created.id ?? created.uid;
  if (!id || !created.url) {
    throw new Error("Vercel did not return a deployment id and URL.");
  }

  const deadline = Date.now() + 8 * 60_000;
  while (Date.now() < deadline) {
    const stateResponse = await vercelRequest(
      `/v13/deployments/${encodeURIComponent(id)}`
    );
    const state = (await stateResponse.json()) as {
      readyState?: string;
      state?: string;
      errorMessage?: string;
    };
    const readyState = state.readyState ?? state.state;
    if (readyState === "READY") break;
    if (["ERROR", "CANCELED"].includes(readyState ?? "")) {
      throw new Error(
        `Vercel deployment failed: ${readyState}${state.errorMessage ? ` — ${state.errorMessage}` : ""}`
      );
    }
    await new Promise((resolve) => setTimeout(resolve, 5_000));
  }

  if (Date.now() >= deadline) {
    throw new Error("Timed out waiting for Vercel preview to become READY.");
  }

  const headers: Record<string, string> = {};
  const bypass = optional("LIVE_CERT_VERCEL_AUTOMATION_BYPASS_SECRET");
  if (bypass) {
    headers["x-vercel-protection-bypass"] = bypass;
    headers["x-vercel-set-bypass-cookie"] = "true";
  }
  const smoke = await fetch(`https://${created.url}/`, {
    headers,
    redirect: "follow",
    signal: AbortSignal.timeout(30_000),
  });
  expect(
    smoke.status,
    `Vercel preview returned HTTP ${smoke.status}. If deployment protection is enabled, configure LIVE_CERT_VERCEL_AUTOMATION_BYPASS_SECRET.`
  ).toBeLessThan(400);

  return { id, url: created.url };
}

async function deleteVercelDeployment(id: string): Promise<void> {
  const response = await fetch(
    `https://api.vercel.com/v13/deployments/${encodeURIComponent(id)}?teamId=${encodeURIComponent(required("LIVE_CERT_VERCEL_TEAM_ID"))}`,
    {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${required("LIVE_CERT_VERCEL_TOKEN")}`,
        "Content-Type": "application/json",
      },
    }
  );
  if (!response.ok && response.status !== 404) {
    throw new Error(`Failed to delete Vercel deployment: HTTP ${response.status}`);
  }
}

async function certifyMongo(runId: string): Promise<void> {
  const client = new MongoClient(required("LIVE_CERT_MONGODB_URI"), {
    serverSelectionTimeoutMS: 12_000,
  });
  const databaseName =
    optional("LIVE_CERT_MONGODB_DATABASE") ?? "buildrx_certification";
  const id = `buildrx-live-cert-${runId}`;

  try {
    await client.connect();
    const collection = client.db(databaseName).collection("live_certification");
    await collection.insertOne({
      _id: id,
      status: "created",
      createdAt: new Date(),
    });
    const created = await collection.findOne({ _id: id });
    expect(created?.status).toBe("created");

    await collection.updateOne(
      { _id: id },
      { $set: { status: "updated", updatedAt: new Date() } }
    );
    const updated = await collection.findOne({ _id: id });
    expect(updated?.status).toBe("updated");

    const deleted = await collection.deleteOne({ _id: id });
    expect(deleted.deletedCount).toBe(1);
  } finally {
    try {
      await client
        .db(databaseName)
        .collection("live_certification")
        .deleteOne({ _id: id });
    } catch {
      // Best-effort cleanup if connection/auth failed mid-test.
    }
    await client.close();
  }
}

async function certifySupabase(runId: string): Promise<void> {
  const url = required("LIVE_CERT_SUPABASE_URL");
  const anonKey =
    optional("LIVE_CERT_SUPABASE_PUBLISHABLE_KEY") ??
    required("LIVE_CERT_SUPABASE_ANON_KEY");
  const serviceRole = required("LIVE_CERT_SUPABASE_SERVICE_ROLE_KEY");

  const admin = createClient(url, serviceRole, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const email = `buildrx-live-cert+${runId}@example.com`;
  const password = `Bx!${runId}a9Z#`.slice(0, 70);

  let userId: string | undefined;
  let projectId: string | undefined;

  try {
    const created = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { name: "BuildRx Live Certification" },
    });
    if (created.error) throw created.error;
    userId = created.data.user?.id;
    if (!userId) throw new Error("Supabase admin createUser returned no user id.");

    const userClient = createClient(url, anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const signedIn = await userClient.auth.signInWithPassword({
      email,
      password,
    });
    if (signedIn.error) throw signedIn.error;
    expect(signedIn.data.user?.id).toBe(userId);

    const inserted = await userClient
      .from("projects")
      .insert({
        owner_id: userId,
        name: `Live Certification ${runId}`,
        description: "created",
        status: "draft",
        is_public: false,
      })
      .select("id, owner_id, description")
      .single();
    if (inserted.error) throw inserted.error;
    projectId = inserted.data.id;
    expect(inserted.data.owner_id).toBe(userId);

    const selected = await userClient
      .from("projects")
      .select("id, description")
      .eq("id", projectId)
      .single();
    if (selected.error) throw selected.error;
    expect(selected.data.description).toBe("created");

    const updated = await userClient
      .from("projects")
      .update({ description: "updated" })
      .eq("id", projectId)
      .select("description")
      .single();
    if (updated.error) throw updated.error;
    expect(updated.data.description).toBe("updated");

    const anonymous = createClient(url, anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const hidden = await anonymous
      .from("projects")
      .select("id")
      .eq("id", projectId);
    if (hidden.error) throw hidden.error;
    expect(hidden.data).toEqual([]);

    const deleted = await userClient
      .from("projects")
      .delete()
      .eq("id", projectId)
      .select("id");
    if (deleted.error) throw deleted.error;
    expect(deleted.data?.[0]?.id).toBe(projectId);
    projectId = undefined;

    await userClient.auth.signOut();
  } finally {
    if (projectId) {
      await admin.from("projects").delete().eq("id", projectId);
    }
    if (userId) {
      await admin.auth.admin.deleteUser(userId);
    }
  }
}

async function certifyAiProvider(): Promise<string> {
  const openRouterKey = optional("LIVE_CERT_OPENROUTER_API_KEY");
  const nvidiaKey = optional("LIVE_CERT_NVIDIA_API_KEY");

  if (!openRouterKey && !nvidiaKey) {
    throw new Error(
      "Configure LIVE_CERT_OPENROUTER_API_KEY or LIVE_CERT_NVIDIA_API_KEY."
    );
  }

  const previousOpenRouter = process.env.OPENROUTER_API_KEY;
  const previousNvidia = process.env.NVIDIA_API_KEY;
  const previousOpenRouterModel = process.env.OPENROUTER_MODEL;
  const previousNvidiaModel = process.env.NVIDIA_CHAT_MODEL;

  try {
    delete process.env.OPENROUTER_API_KEY;
    delete process.env.NVIDIA_API_KEY;

    if (openRouterKey) {
      process.env.OPENROUTER_API_KEY = openRouterKey;
      const model = optional("LIVE_CERT_OPENROUTER_MODEL");
      if (model) process.env.OPENROUTER_MODEL = model;
      const completion = await createOpenRouterChatCompletion(
        [
          {
            role: "user",
            content:
              "Connectivity certification. Reply with exactly BUILD_RX_LIVE_OK and nothing else.",
          },
        ],
        { maxTokens: 16, temperature: 0, timeoutMs: 30_000, model }
      );
      expect(completion.text.trim()).toContain("BUILD_RX_LIVE_OK");
      return `OpenRouter (${completion.model})`;
    }

    process.env.NVIDIA_API_KEY = nvidiaKey;
    const model = optional("LIVE_CERT_NVIDIA_MODEL");
    if (model) process.env.NVIDIA_CHAT_MODEL = model;
    const completion = await createNvidiaChatCompletion(
      [
        {
          role: "user",
          content:
            "Connectivity certification. Reply with exactly BUILD_RX_LIVE_OK and nothing else.",
        },
      ],
      { maxTokens: 16, temperature: 0, timeoutMs: 30_000, model }
    );
    expect(completion.text.trim()).toContain("BUILD_RX_LIVE_OK");
    return `NVIDIA (${completion.model})`;
  } finally {
    if (previousOpenRouter === undefined) delete process.env.OPENROUTER_API_KEY;
    else process.env.OPENROUTER_API_KEY = previousOpenRouter;
    if (previousNvidia === undefined) delete process.env.NVIDIA_API_KEY;
    else process.env.NVIDIA_API_KEY = previousNvidia;
    if (previousOpenRouterModel === undefined) delete process.env.OPENROUTER_MODEL;
    else process.env.OPENROUTER_MODEL = previousOpenRouterModel;
    if (previousNvidiaModel === undefined) delete process.env.NVIDIA_CHAT_MODEL;
    else process.env.NVIDIA_CHAT_MODEL = previousNvidiaModel;
  }
}

afterAll(async () => {
  await Promise.all(
    generatedRoots.map((root) => rm(root, { recursive: true, force: true }))
  );
});

describe("Live Integration Certification", () => {
  it("pushes, deploys, probes live providers, and cleans up disposable resources", async () => {
    const runId =
      optional("GITHUB_RUN_ID") ??
      `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    await summary("# BuildRx Live Integration Certification");
    await summary(`Run: \`${runId}\``);

    const events: AgentEvent[] = [];
    const context: WorkflowContext = {
      projectId: `live-cert-${runId}`,
      userId: null,
      prompt: LIVE_PROMPT,
      persist: false,
      files: new Map(),
    };

    // Keep generation deterministic. Live AI is certified separately below.
    const regularProviderKeys = [
      "OPENROUTER_API_KEY",
      "NVIDIA_API_KEY",
      "ANTHROPIC_API_KEY",
      "NEXT_PUBLIC_SUPABASE_URL",
      "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
      "NEXT_PUBLIC_SUPABASE_ANON_KEY",
      "SUPABASE_SERVICE_ROLE_KEY",
      "MONGODB_URI",
    ] as const;
    const saved = new Map<string, string | undefined>();
    for (const key of regularProviderKeys) {
      saved.set(key, process.env[key]);
      delete process.env[key];
    }

    let github: GithubPush | undefined;
    let deployment: VercelDeployment | undefined;

    try {
      await runWorkflow(context, (event) => events.push(event));

      expect(context.plan).toBeDefined();
      expect(context.files.size).toBeGreaterThan(15);
      expect(events.filter((event) => event.type === "error")).toEqual([]);

      const findings = runStaticChecks(context, context.plan!);
      expect(
        checksPass(findings),
        findings
          .filter((finding) => finding.severity === "error")
          .map(
            (finding) =>
              `[${finding.rule}] ${finding.file ?? ""} ${finding.message}`
          )
          .join("\n")
      ).toBe(true);

      await materialize(context);
      const files = [...context.files.values()].map(({ path, content }) => ({
        path,
        content,
      }));

      github = await pushGeneratedAppToGithub(files, runId);
      await summary(
        `- ✅ GitHub disposable branch push: \`${github.branch}\` @ \`${github.commitSha.slice(0, 8)}\``
      );

      deployment = await deployToVercel(files, github, runId);
      await summary(
        `- ✅ Vercel preview reached READY and responded successfully: https://${deployment.url}`
      );

      await certifyMongo(runId);
      await summary("- ✅ MongoDB Atlas create/read/update/delete");

      await certifySupabase(runId);
      await summary("- ✅ Supabase admin user creation, password auth, RLS CRUD, and cleanup");

      const provider = await certifyAiProvider();
      await summary(`- ✅ AI provider request: ${provider}`);
    } finally {
      for (const key of regularProviderKeys) {
        const original = saved.get(key);
        if (original === undefined) delete process.env[key];
        else process.env[key] = original;
      }

      const cleanupErrors: string[] = [];

      if (deployment) {
        try {
          await deleteVercelDeployment(deployment.id);
          await summary("- 🧹 Vercel preview deleted");
        } catch (error) {
          cleanupErrors.push(
            `Vercel cleanup: ${error instanceof Error ? error.message : String(error)}`
          );
        }
      }

      if (github) {
        try {
          await deleteGithubBranch(github.branch);
          await summary("- 🧹 GitHub disposable branch deleted");
        } catch (error) {
          cleanupErrors.push(
            `GitHub cleanup: ${error instanceof Error ? error.message : String(error)}`
          );
        }
      }

      if (cleanupErrors.length > 0) {
        throw new Error(
          `Live certification cleanup failed:\n${cleanupErrors.join("\n")}`
        );
      }
    }
  }, 15 * 60_000);
});
