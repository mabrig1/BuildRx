import { z } from "zod";

export const publishTemplateSchema = z.object({
  name: z.string().min(1, "Name is required").max(100),
  description: z.string().max(500).optional(),
  category: z.string().min(1).max(50).default("general"),
  prompt: z
    .string()
    .min(10, "Describe what this template builds in at least 10 characters")
    .max(4000),
  thumbnailUrl: z.string().url().max(2000).optional(),
  sourceProjectId: z.string().uuid().optional(),
});

export const updateTemplateSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional(),
  category: z.string().min(1).max(50).optional(),
  prompt: z.string().min(10).max(4000).optional(),
  thumbnailUrl: z.string().url().max(2000).nullable().optional(),
  isActive: z.boolean().optional(),
});
