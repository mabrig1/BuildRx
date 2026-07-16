import { NextResponse } from "next/server";
import { z } from "zod";

import {
  DeployError,
  deployToNetlify,
  deployToRailway,
  deployToVercel,
  type DeployInput,
  type DeployOutcome,
  type DeployProviderName,
} from "@/lib/deploy/providers";
import {
  demoAddDeployment,
  getProviderToken,
  type DeploymentRecord,
} from "@/lib/deploy/service";
import { getFileSystem } from "@/lib/files/manager";
import { getSession } from "@/lib/github/service";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";

export const maxDuration = 300;

const runSchema = z.object({
  projectId: z.string().min(1).max(100),
  provider: z.enum(["vercel", "netlify", "railway"]),
});

const DEMO_URLS: Record<DeployProviderName, (slug: string) => string> = {
  vercel: (slug) => `https://${slug}.vercel.app`,
  netlify: (slug) => `https://${slug}.netlify.app`,
  railway: (slug) => `https://${slug}.up.railway.app`,
};

async function simulateDeploy(
  provider: DeployProviderName,
  slug: string,
  log: (line: string) => void
): Promise<DeployOutcome> {
  const steps = [
    `Authenticating with ${provider}…`,
    "Uploading site files…",
    "Build started",
    "Build completed",
    "Assigning URL…",
  ];
  for (const step of steps) {
    log(step);
    await new Promise((r) => setTimeout(r, 350));
  }
  return {
    status: "live",
    url: DEMO_URLS[provider](slug),
    providerId: `sim_${Date.now()}`,
  };
}

/** POST /api/deploy/run — one-click deploy, streaming NDJSON progress. */
export async function POST(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const parsed = runSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
  const { projectId, provider } = parsed.data;

  // Gather the static site (the generated preview build).
  const fs = getFileSystem(projectId);
  const preview = await fs.read("preview/index.html").catch(() => null);
  if (!preview) {
    return NextResponse.json(
      { error: "Nothing to deploy — run a build first." },
      { status: 400 }
    );
  }
  const siteFiles = [{ path: "index.html", content: preview.content }];

  // Project metadata.
  let projectName = "app-creator-site";
  let githubRepo: string | null = null;
  if (!session.demo) {
    const supabase = await createClient();
    const { data: project } = await supabase
      .from("projects")
      .select("name, github_repo")
      .eq("id", projectId)
      .maybeSingle();
    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }
    projectName = project.name;
    githubRepo = project.github_repo;
  } else {
    const { demoState } = await import("@/lib/github/service");
    githubRepo = demoState().repos.get(projectId)?.fullName ?? null;
    projectName = `demo-${projectId}`;
  }

  const token = await getProviderToken(provider);
  if (!session.demo && !token && provider !== "railway") {
    return NextResponse.json(
      { error: `Connect your ${provider} account first.` },
      { status: 400 }
    );
  }

  const slug = projectName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "site";
  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const logs: string[] = [];
      const emit = (event: Record<string, unknown>) =>
        controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
      const log = (line: string) => {
        logs.push(line);
        emit({ type: "log", line });
      };

      // Create the persistent record up front.
      let recordId: string | null = null;
      const supabase = isSupabaseConfigured() ? await createClient() : null;
      if (supabase && !session.demo) {
        const { data } = await supabase
          .from("deployments")
          .insert({
            project_id: projectId,
            triggered_by: session.userId,
            status: "building",
            provider,
          })
          .select("id")
          .single();
        recordId = data?.id ?? null;
      }
      emit({ type: "status", status: "building" });

      let outcome: DeployOutcome;
      try {
        const input: DeployInput = {
          projectName,
          files: siteFiles,
          githubRepo,
        };
        if (!token) {
          outcome = await simulateDeploy(provider, slug, log);
          log("(Simulated — connect a provider token for real deploys.)");
        } else if (provider === "vercel") {
          outcome = await deployToVercel(token, input, log);
        } else if (provider === "netlify") {
          outcome = await deployToNetlify(token, input, log);
        } else {
          outcome = await deployToRailway(token, input, log);
        }
        log(
          outcome.status === "live"
            ? `Deployed: ${outcome.url}`
            : "Deployment queued."
        );
      } catch (error) {
        const message =
          error instanceof DeployError || error instanceof Error
            ? error.message
            : "Deployment failed";
        log(`Error: ${message}`);
        outcome = { status: "failed", url: null, providerId: null };
      }

      const completedAt = new Date().toISOString();
      if (supabase && !session.demo && recordId) {
        await supabase
          .from("deployments")
          .update({
            status: outcome.status,
            url: outcome.url,
            logs: logs.join("\n"),
            vercel_deployment_id: outcome.providerId,
            completed_at: completedAt,
          })
          .eq("id", recordId);
      }
      if (session.demo) {
        const record: DeploymentRecord = {
          id: `demo_${Date.now()}`,
          provider,
          status: outcome.status,
          url: outcome.url,
          domain: null,
          logs: logs.join("\n"),
          createdAt: completedAt,
          completedAt,
        };
        demoAddDeployment(projectId, record);
      }

      emit({
        type: "complete",
        status: outcome.status,
        url: outcome.url,
      });
      controller.close();
    },
  });

  return new Response(stream, {
    headers: { "Content-Type": "application/x-ndjson; charset=utf-8" },
  });
}
