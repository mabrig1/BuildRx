import { architectAgent } from "@/lib/agents/architect-agent";
import { codingAgent } from "@/lib/agents/coding-agent";
import { databaseAgent } from "@/lib/agents/database-agent";
import { debugAgent } from "@/lib/agents/debug-agent";
import { deploymentAgent } from "@/lib/agents/deployment-agent";
import {
  agentModel,
  degradedEvent,
  diagnoseModelFailure,
  isLlmConfigured,
} from "@/lib/agents/llm";
import { fallbackPlan, plannerAgent } from "@/lib/agents/planner";
import { qaAgent } from "@/lib/agents/qa-agent";
import { repairAgent } from "@/lib/agents/repair-agent";
import { securityAgent } from "@/lib/agents/security-agent";
import {
  AGENT_LABELS,
  AGENT_ORDER,
  type Agent,
  type AgentName,
  type EmitFn,
  type WorkflowContext,
} from "@/lib/agents/types";
import { uiAgent } from "@/lib/agents/ui-agent";
import { recordAiUsage } from "@/lib/ai/usage";
import { isSupabaseConfigured } from "@/lib/supabase/config";

const agents: Record<string, Agent> = {
  planner: plannerAgent,
  architect: architectAgent,
  ui: uiAgent,
  database: databaseAgent,
  coding: codingAgent,
  debug: debugAgent,
  security: securityAgent,
  qa: qaAgent,
  repair: repairAgent,
  deployment: deploymentAgent,
};

/**
 * The Orchestrator Agent — runs the full pipeline:
 *
 *   Planner → Architect → UI → Database → Coding   (generate)
 *   → Debug → Security                              (review)
 *   → QA → Repair                                   (test → fix → retest)
 *   → Deployment                                    (persist + verify)
 *
 * Each agent reads and writes the shared WorkflowContext (the plan, the
 * architecture, the generated-file map, and open findings), so later
 * agents build on earlier output. The Repair Agent runs the bounded
 * autonomous loop internally (fix → re-run checks, at most
 * TOOL_LIMITS.maxRepairRounds rounds); recoverable errors are fixed
 * without user involvement and only what remains is reported.
 */
/**
 * Leaves 30s of the route's 300s maxDuration for the deployment agent's
 * DB writes and the response flush, after six agent steps share the rest.
 * Override with AGENT_PIPELINE_BUDGET_MS when the host caps function
 * duration lower than 300s (some hosting tiers do).
 */
function pipelineBudgetMs(): number {
  const configured = Number(process.env.AGENT_PIPELINE_BUDGET_MS);
  return Number.isFinite(configured) && configured > 10_000 ? configured : 270_000;
}

/**
 * Share of the pipeline budget each step may claim, relative to the
 * steps that haven't run yet. The two file-generating steps need the
 * most; deployment is deterministic I/O and needs almost none. Because
 * the split is recomputed from the *remaining* time before every step,
 * time saved by a fast step is handed to the ones after it.
 */
const AGENT_WEIGHTS: Record<AgentName, number> = {
  // A free inference tier can take 20s+ just to start streaming, so a
  // step's slice has to clear that floor to get any output at all.
  // Spreading the budget evenly across ten steps gave each ~24s and
  // every one of them timed out; the fix is to concentrate it on the
  // three steps that actually write the app and let the rest be
  // deterministic (architect, security, qa and repair all have full
  // non-model paths, and debug is a review pass the build can skip).
  // The planner is the one step whose failure costs the whole build.
  // Everything downstream builds *its* plan, so when it falls back to the
  // built-in template every later agent faithfully generates a generic
  // CRUD app — the user asked for a statistical analysis tool and got
  // "Items / Sample Item 1" because the plan, not the code generation,
  // was the thing that failed. It was on 39s; it now gets the largest
  // share, taken from the two review passes that have full deterministic
  // fallbacks and cost nothing when skipped.
  planner: 4,
  architect: 0.05, // deterministic file map — no model call needed
  ui: 3.5,
  database: 1.25,
  coding: 3.5,
  debug: 0.25, // review pass — the generated files stand without it
  security: 0.05, // deterministic scan
  qa: 0.05, // deterministic checks
  repair: 0.5, // one bounded model pass when findings need it
  deployment: 0.3,
};

/**
 * Held back from every generating step for the deployment step, which
 * has to write every file and publish the preview. A build that
 * generated 25 files and saved none of them is a failed build, so this
 * time is not available to be spent on models no matter how slow they
 * are.
 */
const DEPLOY_RESERVE_MS = 30_000;

/** Absolute deadline for one step, from what the pipeline has left. */
function stepDeadline(context: WorkflowContext, remaining: AgentName[]): number {
  const pipelineEnd = context.deadlineAt ?? Date.now();
  const usableEnd =
    remaining[0] === "deployment" ? pipelineEnd : pipelineEnd - DEPLOY_RESERVE_MS;
  const totalWeight = remaining.reduce((sum, name) => sum + AGENT_WEIGHTS[name], 0);
  const timeLeft = Math.max(0, usableEnd - Date.now());
  const share = (AGENT_WEIGHTS[remaining[0]] / totalWeight) * timeLeft;
  return Math.floor(Date.now() + share);
}

/** How often a running step reports that it is still alive. */
const HEARTBEAT_INTERVAL_MS = 5_000;

export async function runWorkflow(
  context: WorkflowContext,
  emit: EmitFn
): Promise<void> {
  const startedAt = Date.now();
  context.deadlineAt = startedAt + pipelineBudgetMs();
  context.requestId =
    context.requestId ??
    `run_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
  emit({ type: "workflow_start", agents: AGENT_ORDER });

  // Say up front what this build can actually do. Finding out after five
  // minutes that every step fell back to a scaffold is the difference
  // between a slow build and a wasted one.
  if (!isLlmConfigured()) {
    emit(
      degradedEvent(
        undefined,
        "No AI provider is configured — this build will assemble built-in scaffolds instead of generating code from your description.",
        diagnoseModelFailure(new Error("No AI provider is configured."))
      )
    );
  }

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
    for (const [index, name] of AGENT_ORDER.entries()) {
      context.stepDeadlineAt = stepDeadline(context, AGENT_ORDER.slice(index));

      // The planner is what every later step reads; if it produced
      // nothing (a failure its own fallback couldn't cover), the
      // pipeline still needs a plan to build against.
      if (name !== "planner" && !context.plan) {
        context.plan = fallbackPlan(context.prompt);
      }

      // Heartbeat for the duration of this step: a model call can hold
      // the pipeline for a minute, and silence is indistinguishable from
      // a hang. The client's watchdog is idle-based, so these also keep
      // a working build from being cut off by its own browser.
      const heartbeat = setInterval(() => {
        emit({
          type: "heartbeat",
          agent: name,
          requestId: context.requestId!,
          elapsedMs: Date.now() - startedAt,
          remainingMs: Math.max(0, (context.deadlineAt ?? Date.now()) - Date.now()),
        });
      }, HEARTBEAT_INTERVAL_MS);

      try {
        await agents[name].run(context, emit);
      } catch (error) {
        // Deployment is what writes the files and publishes the
        // preview — if that fails there is no build to report, so it
        // stays fatal. Every other step degrades: the user gets the app
        // built so far instead of losing the whole run to one bad step.
        if (name === "deployment") throw error;

        const { classifyThrown } = await import("@/lib/health/error-response");
        const { logError } = await import("@/lib/health/logger");
        const diagnosed = classifyThrown(error);
        await logError("agent-workflow", `${AGENT_LABELS[name]}: ${diagnosed.message}`, {
          code: diagnosed.code,
          subsystem: diagnosed.subsystem,
          stack: error instanceof Error ? error.stack : undefined,
          context: { projectId: context.projectId, agent: name, cause: diagnosed.cause },
        });
        emit({
          type: "error",
          agent: name,
          message: `${diagnosed.message} Continuing with the rest of the build.`,
          code: diagnosed.code,
          cause: diagnosed.cause,
          suggestedFix: diagnosed.suggestedFix,
        });
      } finally {
        clearInterval(heartbeat);
      }
    }

    emit({
      type: "workflow_complete",
      previewUrl: context.previewUrl ?? null,
      fileCount: context.files.size,
      verified: context.verified === true,
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
