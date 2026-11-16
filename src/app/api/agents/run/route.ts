import { NextResponse } from "next/server";
import { z } from "zod";

import { runWorkflow } from "@/lib/agents/orchestrator";
import { toCustomerBuildEvent } from "@/lib/agents/public-progress";
import { logWarn } from "@/lib/health/logger";
import { acquireBuildLease } from "@/lib/agents/build-lease";
import { normalizePlan } from "@/lib/agents/planner";
import type { AgentEvent, AppPlan, WorkflowContext } from "@/lib/agents/types";
import { authorizeAiRequest } from "@/lib/ai/route-helpers";
import { withTimeout } from "@/lib/health/retry";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";
import { getFileSystem } from "@/lib/files/manager";
import { TOOL_LIMITS } from "@/lib/agents/tools";
import { isBuildBrief, isRepairCommand } from "@/lib/validations/build-prompt";
import { MAX_AI_PROMPT_CHARACTERS } from "@/lib/validations/limits";

export const maxDuration = 300;

const runSchema = z.object({
  projectId: z.string().min(1).max(100),
  prompt: z
    .string()
    .trim()
    .max(MAX_AI_PROMPT_CHARACTERS)
    .refine(value => isBuildBrief(value) || isRepairCommand(value), "Describe your app in at least 10 characters"),
  previousBrief: z.string().trim().max(MAX_AI_PROMPT_CHARACTERS).optional(),
});

/**
 * POST /api/agents/run — runs the multi-agent build pipeline for a
 * project, streaming progress events as NDJSON.
 */
export async function POST(request: Request) {
  const auth = await authorizeAiRequest();
  if (!auth.ok) return auth.response;

  const body = await request.json().catch(() => null);
  const parsed = runSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid request" },
      { status: 400 }
    );
  }
  const { projectId, prompt } = parsed.data;

  const persist = isSupabaseConfigured();
  if (persist) {
    const supabase = await createClient();
    try {
      const { data: project } = await withTimeout(
        () => supabase.from("projects").select("id").eq("id", projectId).eq("owner_id", auth.userId!).single(),
        20_000,
        "project lookup"
      );
      if (!project) {
        return NextResponse.json({ error: "Project not found" }, { status: 404 });
      }
    } catch {
      return NextResponse.json(
        { error: "The database is taking too long to respond. Please try again." },
        { status: 504 }
      );
    }
  }

  const releaseBuildLease = acquireBuildLease(projectId, auth.userId);
  if (!releaseBuildLease) {
    return NextResponse.json(
      { error: "A build is already running for this project. Check its progress before starting another." },
      { status: 409 }
    );
  }

  const context: WorkflowContext = {
    projectId,
    userId: auth.userId,
    prompt,
    persist,
    files: new Map(),
  };

  if (isRepairCommand(prompt)) {
    try {
      const files = await withTimeout(
        () => getFileSystem(projectId).readSnapshot(TOOL_LIMITS.maxFiles), 20_000, "Saved project lookup"
      );
      context.files = new Map(files.map(file => [file.path, file]));
      // New builds leave their exact plan with the completion message. Older
      // projects fall back to the workspace brief and their saved files.
      let storedPrompt: string | undefined;
      let storedPlan: Partial<AppPlan> | undefined;
      if (persist && files.length) {
        const db = await createClient();
        const { data, error } = await withTimeout(
          () => db.from("chat_messages").select("metadata").eq("project_id", projectId)
            .eq("role", "assistant").contains("metadata", { kind: "build-result" })
            .order("created_at", { ascending: false }).limit(1).maybeSingle(), 10_000, "Previous build lookup"
        );
        if (error) throw new Error("Could not load the previous build.");
        const meta = data?.metadata;
        if (meta && typeof meta === "object" && !Array.isArray(meta) && typeof meta.prompt === "string" &&
            meta.plan && typeof meta.plan === "object" && !Array.isArray(meta.plan)) {
          storedPrompt = meta.prompt;
          storedPlan = meta.plan as Partial<AppPlan>;
        }
      }
      const savedBrief = context.files.get("docs/PRODUCT-BRIEF.md")?.content;
      const brief = [storedPrompt, parsed.data.previousBrief, savedBrief, context.files.get("README.md")?.content]
        .map(value => value?.trim().slice(0, MAX_AI_PROMPT_CHARACTERS))
        .find((value): value is string => Boolean(value && isBuildBrief(value)));
      if (!brief) {
        releaseBuildLease();
        return NextResponse.json({ error: "No previous build brief was found. Describe the app you want to repair." }, { status: 422 });
      }
      context.prompt = brief;
      if (storedPlan) context.plan = normalizePlan(storedPlan, brief);
      if (files.length) context.repairSnapshot = new Map(files.map(file => [file.path, file.content]));
    } catch {
      releaseBuildLease();
      return NextResponse.json({ error: "Could not load the complete saved project for repair. Your files were left in place." }, { status: 503 });
    }
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      // A disconnected client must not abort a build in progress: once
      // the browser is gone, enqueue throws, and that exception would
      // otherwise propagate up through the pipeline and cancel it before
      // the files were ever saved. Closing the tab now just means nobody
      // is watching — the build finishes and persists either way.
      let clientGone = false;
      const emit = (event: AgentEvent) => {
        // Full provider diagnostics belong in administrator logs, never in customer streams.
        if (event.type === "agent_degraded") {
          void logWarn("agents-run", event.message, {
            code: event.code,
            subsystem: "ai",
            context: { projectId, agent: event.agent, cause: event.cause },
          });
        }
        if (clientGone) return;
        try {
          const customerEvent = toCustomerBuildEvent(event);
          controller.enqueue(encoder.encode(`${JSON.stringify(customerEvent)}\n`));
        } catch {
          clientGone = true;
        }
      };
      try {
        await runWorkflow(context, emit);
      } catch (error) {
        const { classifyThrown } = await import("@/lib/health/error-response");
        const { logError } = await import("@/lib/health/logger");
        const diagnosed = classifyThrown(error);
        await logError("agents-run", diagnosed.message, {
          code: diagnosed.code,
          subsystem: diagnosed.subsystem,
          stack: error instanceof Error ? error.stack : undefined,
          context: { projectId, cause: diagnosed.cause },
        });
        emit({
          type: "error",
          message: diagnosed.message,
          code: diagnosed.code,
          cause: diagnosed.cause,
          suggestedFix: diagnosed.suggestedFix,
        });
      } finally {
        releaseBuildLease();
        try {
          controller.close();
        } catch {
          // Already closed by the client disconnecting — nothing to do.
        }
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-store, no-transform",
      "X-Accel-Buffering": "no",
      ...auth.limitHeaders,
    },
  });
}
