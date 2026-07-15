import { codingAgent } from "@/lib/agents/coding-agent";
import { databaseAgent } from "@/lib/agents/database-agent";
import { debugAgent } from "@/lib/agents/debug-agent";
import { deploymentAgent } from "@/lib/agents/deployment-agent";
import { AGENT_MODEL } from "@/lib/agents/llm";
import { plannerAgent } from "@/lib/agents/planner";
import {
  AGENT_LABELS,
  AGENT_ORDER,
  type Agent,
  type EmitFn,
  type WorkflowContext,
} from "@/lib/agents/types";
import { uiAgent } from "@/lib/agents/ui-agent";
import { recordAiUsage } from "@/lib/ai/usage";
import { isSupabaseConfigured } from "@/lib/supabase/config";

const agents: Record<string, Agent> = {
  planner: plannerAgent,
  ui: uiAgent,
  database: databaseAgent,
  coding: codingAgent,
  debug: debugAgent,
  deployment: deploymentAgent,
};

/**
 * Runs the full agent pipeline:
 *
 *   Planner → UI → Database → Coding → Debug → Deployment
 *
 * Each agent reads and writes the shared WorkflowContext (the plan and
 * the generated-file map), so later agents build on earlier output.
 * Progress is reported through `emit`.
 */
export async function runWorkflow(
  context: WorkflowContext,
  emit: EmitFn
): Promise<void> {
  const startedAt = Date.now();
  emit({ type: "workflow_start", agents: AGENT_ORDER });

  // Mark the project as generating while the pipeline runs.
  if (context.persist && isSupabaseConfigured()) {
    const { createClient } = await import("@/lib/supabase/server");
    const supabase = await createClient();
    await supabase
      .from("projects")
      .update({ status: "generating" })
      .eq("id", context.projectId);
  }

  try {
    for (const name of AGENT_ORDER) {
      await agents[name].run(context, emit);
    }

    emit({
      type: "workflow_complete",
      previewUrl: context.previewUrl ?? null,
      fileCount: context.files.size,
    });

    if (context.userId) {
      await recordAiUsage({
        userId: context.userId,
        projectId: context.persist ? context.projectId : undefined,
        model: AGENT_MODEL,
        status: "completed",
        promptTokens: 0,
        completionTokens: 0,
        durationMs: Date.now() - startedAt,
        action: "ai_generation",
      });
    }
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Agent workflow failed";
    emit({ type: "error", message });

    if (context.persist && isSupabaseConfigured()) {
      const { createClient } = await import("@/lib/supabase/server");
      const supabase = await createClient();
      await supabase
        .from("projects")
        .update({ status: "error" })
        .eq("id", context.projectId);
    }
    if (context.userId) {
      await recordAiUsage({
        userId: context.userId,
        projectId: context.persist ? context.projectId : undefined,
        model: AGENT_MODEL,
        status: "failed",
        promptTokens: 0,
        completionTokens: 0,
        durationMs: Date.now() - startedAt,
        error: message,
        action: "ai_generation",
      });
    }
  }
}

export { AGENT_LABELS, AGENT_ORDER };
