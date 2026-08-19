import { z } from "zod";

import { MAX_AI_PROMPT_CHARACTERS } from "@/lib/validations/limits";

export const generateTextSchema = z.object({
  prompt: z
    .string()
    .min(1, "Prompt cannot be empty")
    .max(
      MAX_AI_PROMPT_CHARACTERS,
      `Prompt must be at most ${MAX_AI_PROMPT_CHARACTERS.toLocaleString()} characters`
    ),
  system: z.string().max(4000).optional(),
  projectId: z.string().uuid().optional(),
  model: z.string().max(120).optional(),
  maxTokens: z.number().int().min(1).max(16384).optional(),
  temperature: z.number().min(0).max(1).optional(),
  topP: z.number().min(0).max(1).optional(),
  seed: z.number().int().optional(),
  stream: z.boolean().default(true),
});

export const generateCodeSchema = z.object({
  prompt: z
    .string()
    .min(1, "Prompt cannot be empty")
    .max(
      MAX_AI_PROMPT_CHARACTERS,
      `Prompt must be at most ${MAX_AI_PROMPT_CHARACTERS.toLocaleString()} characters`
    ),
  language: z.string().max(40).optional(),
  context: z
    .string()
    .max(16000, "Context must be at most 16,000 characters")
    .optional(),
  projectId: z.string().uuid().optional(),
  stream: z.boolean().default(true),
});

export type GenerateTextInput = z.infer<typeof generateTextSchema>;
export type GenerateCodeInput = z.infer<typeof generateCodeSchema>;
