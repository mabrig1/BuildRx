import { z } from "zod";

export const providerIdSchema = z.enum([
  "nvidia",
  "openai",
  "anthropic",
  "gemini",
  "deepseek",
  "grok",
]);

export const completeSchema = z.object({
  provider: providerIdSchema,
  prompt: z
    .string()
    .min(1, "Prompt cannot be empty")
    .max(8000, "Prompt must be at most 8,000 characters"),
  system: z.string().max(4000).optional(),
  model: z.string().max(120).optional(),
  maxTokens: z.number().int().min(1).max(16384).optional(),
  temperature: z.number().min(0).max(2).optional(),
  topP: z.number().min(0).max(1).optional(),
  stream: z.boolean().default(true),
  projectId: z.string().uuid().optional(),
});

export const compareSchema = z.object({
  prompt: z
    .string()
    .min(1, "Prompt cannot be empty")
    .max(4000, "Prompt must be at most 4,000 characters"),
  system: z.string().max(2000).optional(),
  targets: z
    .array(
      z.object({
        provider: providerIdSchema,
        model: z.string().min(1).max(120),
      })
    )
    .min(2, "Pick at least two models to compare")
    .max(6, "Compare at most 6 models at once"),
});

export const aiSettingsSchema = z.object({
  defaultProvider: providerIdSchema,
  defaultModel: z.string().min(1).max(120),
});

export type CompleteInput = z.infer<typeof completeSchema>;
export type CompareInput = z.infer<typeof compareSchema>;
export type AiSettingsInput = z.infer<typeof aiSettingsSchema>;
