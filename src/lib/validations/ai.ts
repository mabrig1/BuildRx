import { z } from "zod";

export const generateTextSchema = z.object({
  prompt: z
    .string()
    .min(1, "Prompt cannot be empty")
    .max(8000, "Prompt must be at most 8,000 characters"),
  system: z.string().max(4000).optional(),
  projectId: z.string().uuid().optional(),
  model: z.string().max(120).optional(),
  maxTokens: z.number().int().min(1).max(8192).optional(),
  temperature: z.number().min(0).max(1).optional(),
  stream: z.boolean().default(true),
});

export const generateCodeSchema = z.object({
  prompt: z
    .string()
    .min(1, "Prompt cannot be empty")
    .max(8000, "Prompt must be at most 8,000 characters"),
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
