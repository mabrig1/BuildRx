import { codingAgent } from "@/lib/agents/coding-agent";
import { databaseAgent } from "@/lib/agents/database-agent";
import { debugAgent } from "@/lib/agents/debug-agent";
import { deploymentAgent } from "@/lib/agents/deployment-agent";
import { agentModel } from "@/lib/agents/llm";
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
/**
 * Leaves 30s of the route's 300s maxDuration for the deployment agent's
 * DB writes and the response flush, after six agent steps share the rest.
 */
const PIPELINE_BUDGET_MS = 270_000;

export async function runWorkflow(
  context: WorkflowContext,
  emit: EmitFn
): Promise<void> {
  const startedAt = Date.now();
  context.deadlineAt = startedAt + PIPELINE_BUDGET_MS;
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
      if (Date.now() >= context.deadlineAt!) {
        throw new Error(
          `Ran out of time before the ${AGENT_LABELS[name]} could start.`
        );
      }
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
        model: agentModel(),
        status: "completed",
        promptTokens: 0,
        completionTokens: 0,
        durationMs: Date.now() - startedAt,
        action: "ai_generation",
      });
    }
  } catch (error) {
    const { classifyThrown } = await import("@/lib/health/error-response");
    const { logError } = await import("@/lib/health/logger");
    const diagnosed = classifyThrown(error);
    const message = diagnosed.message;

    await logError("agent-workflow", message, {
      code: diagnosed.code,
      subsystem: diagnosed.subsystem,
      stack: error instanceof Error ? error.stack : undefined,
      context: { projectId: context.projectId, cause: diagnosed.cause },
    });

    emit({
      type: "error",
      message,
      code: diagnosed.code,
      cause: diagnosed.cause,
      suggestedFix: diagnosed.suggestedFix,
    });

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
        model: agentModel(),
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
