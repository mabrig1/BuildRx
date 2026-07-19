/**
 * Runs a workflow: executes its steps in order, synchronously, within
 * one call — there's no queue/worker in this deployment, so a workflow
 * run is only as long-lived as the request that triggered it. Each
 * step's config is template-rendered against prior steps' outputs
 * before it runs (see template.ts), and every step — success or
 * failure — is recorded to workflow_run_steps for the run history UI.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

import { recordAiUsage } from "@/lib/ai/usage";
import { parseStepConfig } from "@/lib/validations/workflows";
import { executeStep, type StepExecutionContext } from "@/lib/workflows/steps";
import { renderConfigTemplates, stringifyTriggerInput } from "@/lib/workflows/template";
import type { Database, Json, WorkflowStepType } from "@/types/database";

type StepRow = Database["public"]["Tables"]["workflow_steps"]["Row"];

export interface WorkflowRunOutcome {
  runId: string;
  status: "completed" | "failed";
  error: string | null;
}

export async function runWorkflow({
  supabase,
  ownerId,
  workflowId,
  steps,
  trigger,
  triggerInput,
}: {
  supabase: SupabaseClient<Database>;
  ownerId: string;
  workflowId: string;
  /** Already loaded and sorted by position. */
  steps: StepRow[];
  trigger: "manual" | "webhook";
  triggerInput?: Json;
}): Promise<WorkflowRunOutcome> {
  const run = await supabase
    .from("workflow_runs")
    .insert({
      workflow_id: workflowId,
      owner_id: ownerId,
      status: "running",
      trigger,
      trigger_input: stringifyTriggerInput(triggerInput) || null,
    })
    .select("id")
    .single();
  if (run.error || !run.data) {
    throw new Error(run.error?.message ?? "Failed to start workflow run");
  }
  const runId = run.data.id;

  const values: Record<string, string> = { "trigger.text": stringifyTriggerInput(triggerInput) };
  const ctx: StepExecutionContext = { supabase, ownerId };

  for (let i = 0; i < steps.length; i++) {
    const step = steps[i];
    const position = i + 1;
    const stepStartedAt = Date.now();

    const renderedConfig = renderConfigTemplates(step.config as Record<string, unknown>, values);

    const parsed = parseStepConfig(step.type as WorkflowStepType, renderedConfig);
    if (!parsed.success) {
      const error = parsed.error.issues[0]?.message ?? "Invalid step configuration";
      await recordRunStep(supabase, {
        runId,
        ownerId,
        position,
        step,
        status: "failed",
        input: renderedConfig as Json,
        output: null,
        error,
      });
      return finishRun(supabase, runId, "failed", error);
    }

    try {
      const result = await executeStep(step.type as WorkflowStepType, parsed.data, ctx);

      await recordRunStep(supabase, {
        runId,
        ownerId,
        position,
        step,
        status: "completed",
        input: renderedConfig as Json,
        output: result.output as unknown as Json,
        error: null,
      });

      if (result.usage) {
        await recordAiUsage({
          userId: ownerId,
          provider: result.usage.provider,
          model: result.usage.model,
          status: "completed",
          promptTokens: result.usage.promptTokens,
          completionTokens: result.usage.completionTokens,
          durationMs: Date.now() - stepStartedAt,
          action: "ai_generation",
        });
      }

      values[`step${position}.text`] = result.output.text;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Step failed";
      await recordRunStep(supabase, {
        runId,
        ownerId,
        position,
        step,
        status: "failed",
        input: renderedConfig as Json,
        output: null,
        error: message,
      });
      return finishRun(supabase, runId, "failed", message);
    }
  }

  return finishRun(supabase, runId, "completed", null);
}

async function recordRunStep(
  supabase: SupabaseClient<Database>,
  params: {
    runId: string;
    ownerId: string;
    position: number;
    step: StepRow;
    status: "completed" | "failed";
    input: Json;
    output: Json | null;
    error: string | null;
  }
) {
  await supabase.from("workflow_run_steps").insert({
    run_id: params.runId,
    owner_id: params.ownerId,
    position: params.position,
    step_name: params.step.name,
    step_type: params.step.type,
    status: params.status,
    input: params.input,
    output: params.output,
    error: params.error,
    completed_at: new Date().toISOString(),
  });
}

async function finishRun(
  supabase: SupabaseClient<Database>,
  runId: string,
  status: "completed" | "failed",
  error: string | null
): Promise<WorkflowRunOutcome> {
  await supabase
    .from("workflow_runs")
    .update({ status, error, completed_at: new Date().toISOString() })
    .eq("id", runId);
  return { runId, status, error };
}
