import { NextResponse } from "next/server";
import { z } from "zod";

import { runWorkflow } from "@/lib/agents/orchestrator";
import type { AgentEvent, WorkflowContext } from "@/lib/agents/types";
import { authorizeAiRequest } from "@/lib/ai/route-helpers";
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
    const { data: project } = await supabase
      .from("projects")
      .select("id")
      .eq("id", projectId)
      .single();
    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
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
      const emit = (event: AgentEvent) => {
        controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
      };
      try {
        await runWorkflow(context, emit);
      } catch (error) {
        emit({
          type: "error",
          message:
            error instanceof Error ? error.message : "Workflow crashed",
        });
      }
      controller.close();
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
