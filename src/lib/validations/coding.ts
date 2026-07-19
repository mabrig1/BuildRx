import { z } from "zod";

import { providerIdSchema } from "@/lib/validations/ai-platform";

const codeSchema = z
  .string()
  .min(1, "Code cannot be empty")
  .max(16_000, "Code must be at most 16,000 characters");

const baseSchema = z.object({
  code: codeSchema,
  language: z.string().max(40).optional(),
  provider: providerIdSchema,
  model: z.string().max(120).optional(),
  projectId: z.string().uuid().optional(),
});

export const explainCodeSchema = baseSchema;

export const debugCodeSchema = baseSchema.extend({
  errorMessage: z.string().max(2000).optional(),
});

export const refactorCodeSchema = baseSchema.extend({
  instruction: z
    .string()
    .min(1, "Describe what to refactor")
    .max(1000, "Instruction must be at most 1,000 characters"),
});

export const generateTestsSchema = baseSchema.extend({
  filePath: z.string().max(300).optional(),
});

export const generateDocsSchema = baseSchema;

export type ExplainCodeInput = z.infer<typeof explainCodeSchema>;
export type DebugCodeInput = z.infer<typeof debugCodeSchema>;
export type RefactorCodeInput = z.infer<typeof refactorCodeSchema>;
export type GenerateTestsInput = z.infer<typeof generateTestsSchema>;
export type GenerateDocsInput = z.infer<typeof generateDocsSchema>;
