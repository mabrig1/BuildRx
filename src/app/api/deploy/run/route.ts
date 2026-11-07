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
import {
  fileWithEmbeddedCredential,
  isDeploymentSourcePath,
} from "@/lib/deploy/source";
import { getFileSystem } from "@/lib/files/manager";
import { getSession } from "@/lib/github/service";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";
import { enforceDevShieldPreflight, DevShieldPreflightError, devShieldPublicEvidence } from "@/lib/security/devshield-preflight";

export const maxDuration = 300;

const runSchema = z.object({
  projectId: z.string().min(1).max(100),
  provider: z.enum(["vercel", "netlify", "railway"]),
});

async function simulateDeploy(
  provider: DeployProviderName,
  log: (line: string) => void
): Promise<DeployOutcome> {
  const steps = [
    `Demonstrating the ${provider} publish flow…`,
    "Demo projects cannot publish live apps. Sign in to save and launch a real project.",
  ];
  for (const step of steps) {
    log(step);
    await new Promise((r) => setTimeout(r, 350));
  }
  return {
    status: "failed",
    url: null,
    providerId: null,
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

  // Prevent expired, unauthorized, or unverified releases before reading
  // project files, accessing provider credentials or spending deploy credits.
  if (!session.demo) {
    const supabase = await createClient();
    const { data: ownProject, error: ownerError } = await supabase
      .from("projects")
      .select("name, status, github_repo")
      .eq("id", projectId)
      .eq("owner_id", session.userId!)
      .maybeSingle();
    if (ownerError) {
      return NextResponse.json({ error: "Unable to verify app ownership." }, { status: 503 });
    }
    if (!ownProject) {
      return NextResponse.json({ error: "App not found." }, { status: 404 });
    }
    if (ownProject.status !== "ready") {
      return NextResponse.json({ error: "Your app needs to pass its checks before it can go live. Rebuild or repair it first." }, { status: 409 });
    }
  }

  // Gather the static preview plus the complete generated project. A
  // Vercel deployment must receive the Next.js source tree, not only
  // preview/index.html; the latter is a mock preview with no API or
  // persistence and was the main reason "deployed" apps were not real.
  const fs = getFileSystem(projectId);
  const preview = await fs.read("preview/index.html").catch(() => null);
  // A verified Next.js app can be published directly even when its optional
  // static preview has not been generated.
  if (!preview && (provider !== "vercel" || session.demo)) {
    return NextResponse.json(
      { error: "Nothing to deploy — run a build first." },
      { status: 400 }
    );
  }
  const siteFiles = preview ? [{ path: "index.html", content: preview.content }] : [];
  const entries = await fs.list();
  const sourceEntries = entries.filter((entry) => isDeploymentSourcePath(entry.path));
  const projectFiles = (
    await Promise.all(
      sourceEntries.map((entry) => fs.read(entry.path))
    )
  )
    .filter((file): file is NonNullable<typeof file> => Boolean(file))
    .map((file) => ({ path: file.path, content: file.content }));
  if (!session.demo && projectFiles.length !== sourceEntries.length) {
    return NextResponse.json({
      error: "Project source changed while being checked. Retry before publishing.",
    }, { status: 409, headers: { "Cache-Control": "no-store" } });
  }
  if (!session.demo && (
    !projectFiles.some((file) => file.path === "package.json") ||
    !(
      projectFiles.some((file) => file.path === "src/app/page.tsx") &&
      projectFiles.some((file) => file.path === "src/app/layout.tsx") ||
      projectFiles.some((file) => file.path === "app/page.tsx") &&
      projectFiles.some((file) => file.path === "app/layout.tsx")
    )
  )) {
    return NextResponse.json(
      { error: "Your app source is incomplete. Run Repair and verify a real application before publishing." },
      { status: 409 }
    );
  }
  const credentialFile = fileWithEmbeddedCredential(projectFiles);
  if (credentialFile) {
    return NextResponse.json(
      {
        error: `Deployment blocked: ${credentialFile} contains a credential-like value. Move it to the provider's encrypted environment settings.`,
      },
      { status: 400 }
    );
  }

  // Scan the actual saved project source BEFORE reading provider credentials,
  // recording a deployment, or uploading code to a remote builder.
  if (!session.demo) {
    try {
      enforceDevShieldPreflight(projectFiles);
    } catch (error) {
      if (error instanceof DevShieldPreflightError) {
        return NextResponse.json({
          error: error.message,
          securityPreflight: devShieldPublicEvidence(error.report),
        }, { status: 409, headers: { "Cache-Control": "no-store" } });
      }
      throw error;
    }
  }

  // Project metadata.
  let projectName = "app-creator-site";
  let githubRepo: string | null = null;
  if (!session.demo) {
    const supabase = await createClient();
    const { data: project } = await supabase
      .from("projects")
      .select("name, github_repo")
      .eq("id", projectId)
      .eq("owner_id", session.userId!)
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

  const token = session.demo ? null : await getProviderToken(provider);
  if (!session.demo && !token) {
    return NextResponse.json(
      { error: `Connect your ${provider} account first.` },
      { status: 400 }
    );
  }

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
          files:
            provider === "vercel" &&
            projectFiles.some((file) => file.path === "package.json")
              ? projectFiles
              : siteFiles,
          githubRepo,
          framework:
            provider === "vercel" &&
            projectFiles.some((file) => file.path === "package.json")
              ? "nextjs"
              : null,
        };
        if (session.demo) {
          outcome = await simulateDeploy(provider, log);
          log("(Demo only — no real app was published.)");
        } else if (!token) {
          throw new DeployError("Connect your hosting account before publishing.");
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
            : outcome.status === "failed"
              ? "Not published."
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
