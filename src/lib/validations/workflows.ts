import { z } from "zod";

import { contentInputsSchema, contentTypeSchema } from "@/lib/validations/content";
import { providerIdSchema } from "@/lib/validations/ai-platform";

export const workflowStepTypeSchema = z.enum([
  "ai_generate",
  "agent_run",
  "content_generate",
  "kb_chat",
  "webhook",
]);

const aiGenerateConfigSchema = z.object({
  system: z.string().max(4000).optional(),
  prompt: z.string().min(1, "Prompt is required").max(8000),
  provider: providerIdSchema,
  model: z.string().max(120).optional(),
});

const agentRunConfigSchema = z.object({
  agentId: z.string().uuid("Choose an agent"),
  message: z.string().min(1, "Message is required").max(4000),
});

const contentGenerateConfigSchema = z.object({
  contentType: contentTypeSchema,
  inputs: contentInputsSchema,
  provider: providerIdSchema,
  model: z.string().max(120).optional(),
});

const kbChatConfigSchema = z.object({
  knowledgeBaseId: z.string().uuid("Choose a knowledge base"),
  question: z.string().min(1, "Question is required").max(2000),
  provider: providerIdSchema,
  model: z.string().max(120).optional(),
});

const webhookConfigSchema = z.object({
  url: z.string().url("Enter a valid URL"),
  payload: z.string().max(4000).optional(),
});

/** Per-type config schema — kept alongside the step type so the API can validate before saving or running a step. */
export const STEP_CONFIG_SCHEMAS = {
  ai_generate: aiGenerateConfigSchema,
  agent_run: agentRunConfigSchema,
  content_generate: contentGenerateConfigSchema,
  kb_chat: kbChatConfigSchema,
  webhook: webhookConfigSchema,
} as const;

export const createWorkflowSchema = z.object({
  name: z.string().min(1, "Name is required").max(150),
  description: z.string().max(1000).optional(),
});

export const updateWorkflowSchema = z.object({
  name: z.string().min(1).max(150).optional(),
  description: z.string().max(1000).optional(),
  enabled: z.boolean().optional(),
  triggerType: z.enum(["manual", "webhook"]).optional(),
});

export const createStepSchema = z.object({
  name: z.string().min(1, "Name is required").max(150),
  type: workflowStepTypeSchema,
  config: z.record(z.string(), z.unknown()),
});

export const updateStepSchema = z.object({
  name: z.string().min(1).max(150).optional(),
  config: z.record(z.string(), z.unknown()).optional(),
});

export const reorderStepsSchema = z.object({
  stepIds: z.array(z.string().uuid()).min(1),
});

export const runWorkflowSchema = z.object({
  input: z.string().max(4000).optional(),
});

/** Validates a step's `config` against the schema for its `type`. Shared by the API (on save) and the engine (defense in depth before executing). */
export function parseStepConfig(type: keyof typeof STEP_CONFIG_SCHEMAS, config: unknown) {
  return STEP_CONFIG_SCHEMAS[type].safeParse(config);
}
