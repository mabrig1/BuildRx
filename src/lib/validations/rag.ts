import { z } from "zod";

import { providerIdSchema } from "@/lib/validations/ai-platform";

export const createKnowledgeBaseSchema = z.object({
  name: z.string().min(1, "Name is required").max(150),
  description: z.string().max(1000).optional(),
});

export const updateKnowledgeBaseSchema = z.object({
  name: z.string().min(1).max(150).optional(),
  description: z.string().max(1000).optional(),
});

export const ragChatSchema = z.object({
  message: z.string().min(1, "Message is required").max(2000),
  provider: providerIdSchema,
  model: z.string().max(120).optional(),
});
