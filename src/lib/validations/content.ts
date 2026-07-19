import { z } from "zod";

import { providerIdSchema } from "@/lib/validations/ai-platform";

export const contentTypeSchema = z.enum([
  "blog_post",
  "ebook",
  "social_post",
  "email",
  "ad_copy",
  "video_script",
]);

export const contentInputsSchema = z.object({
  topic: z.string().max(500).optional(),
  tone: z.string().max(100).optional(),
  targetAudience: z.string().max(300).optional(),
  keywords: z.string().max(300).optional(),
  wordCount: z.enum(["short", "medium", "long"]).optional(),
  platform: z.string().max(50).optional(),
  includeHashtags: z.boolean().optional(),
  purpose: z.string().max(100).optional(),
  callToAction: z.string().max(200).optional(),
  product: z.string().max(300).optional(),
  chapterCount: z.number().int().min(3).max(8).optional(),
  videoLength: z.enum(["short", "long"]).optional(),
});

export const createContentSchema = z.object({
  type: contentTypeSchema,
  inputs: contentInputsSchema,
  provider: providerIdSchema,
  model: z.string().max(120).optional(),
});

export const updateContentSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  content: z.string().max(100_000).optional(),
});

export const promptLibraryItemSchema = z.object({
  title: z.string().min(1, "Title is required").max(150),
  category: contentTypeSchema.or(z.literal("general")).default("general"),
  promptText: z
    .string()
    .min(1, "Prompt text is required")
    .max(4000, "Prompt must be at most 4,000 characters"),
});

export type CreateContentInput = z.infer<typeof createContentSchema>;
export type UpdateContentInput = z.infer<typeof updateContentSchema>;
export type PromptLibraryItemInput = z.infer<typeof promptLibraryItemSchema>;
