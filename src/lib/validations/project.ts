import { z } from "zod";

import { MAX_AI_PROMPT_CHARACTERS } from "@/lib/validations/limits";

export const createProjectSchema = z.object({
  name: z
    .string()
    .min(2, "Project name must be at least 2 characters")
    .max(60, "Project name must be at most 60 characters"),
  description: z
    .string()
    .max(500, "Description must be at most 500 characters")
    .optional(),
  prompt: z
    .string()
    .max(
      MAX_AI_PROMPT_CHARACTERS,
      `Prompt must be at most ${MAX_AI_PROMPT_CHARACTERS.toLocaleString()} characters`
    )
    .refine(
      (value) => value.length === 0 || value.trim().length >= 10,
      "Describe your app in at least 10 characters"
    )
    .optional(),
});

export const updateProjectSchema = createProjectSchema.partial().extend({
  id: z.string().uuid(),
});

export type CreateProjectInput = z.infer<typeof createProjectSchema>;
export type UpdateProjectInput = z.infer<typeof updateProjectSchema>;
