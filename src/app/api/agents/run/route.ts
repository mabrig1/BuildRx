import { NextResponse } from "next/server";
import { z } from "zod";

import { runWorkflow } from "@/lib/agents/orchestrator";
import type { AgentEvent, WorkflowContext } from "@/lib/agents/types";
import { authorizeAiRequest } from "@/lib/ai/route-helpers";
import { withTimeout } from "@/lib/health/retry";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";

export const maxDuration = 300;

const runSchema = z.object({
  projectId: z.string().min(1).max(100),
  prompt: z
    .string()
    .min(10, "Describe your app in at least 10 characters")
    .max(4000),
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
        () => supabase.from("projects").select("id").eq("id", projectId).single(),
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

  const context: WorkflowContext = {
    projectId,
    userId: auth.userId,
    prompt,
    persist,
    files: new Map(),
  };

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
        if (clientGone) return;
        try {
          controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
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
      }
      try {
        controller.close();
      } catch {
        // Already closed by the client disconnecting — nothing to do.
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-cache",
      ...auth.limitHeaders,
    },
  });
}
