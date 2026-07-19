import { z } from "zod";

import { AVAILABLE_TOOL_IDS } from "@/lib/ai-agents/tools";
import { providerIdSchema } from "@/lib/validations/ai-platform";

const visibilitySchema = z.enum(["private", "unlisted", "public"]);
const toolIdSchema = z.enum(AVAILABLE_TOOL_IDS);

export const createAgentSchema = z.object({
  name: z.string().min(1, "Name is required").max(80),
  description: z.string().max(300).optional(),
  icon: z.string().max(8).optional(),
  systemPrompt: z
    .string()
    .min(1, "System prompt is required")
    .max(8000, "System prompt must be at most 8,000 characters"),
  provider: providerIdSchema,
  model: z.string().min(1, "Choose a model").max(120),
  tools: z.array(toolIdSchema).max(AVAILABLE_TOOL_IDS.length).default([]),
  visibility: visibilitySchema.default("private"),
});

export const updateAgentSchema = createAgentSchema.partial();

export const knowledgeFileSchema = z.object({
  name: z.string().min(1).max(200),
  content: z
    .string()
    .min(1, "File is empty")
    .max(50_000, "Knowledge files are capped at 50,000 characters"),
});

export const createConversationSchema = z.object({
  title: z.string().max(120).optional(),
});

export const agentChatSchema = z.object({
  conversationId: z.string().uuid().optional(),
  message: z
    .string()
    .min(1, "Message cannot be empty")
    .max(8000, "Message must be at most 8,000 characters"),
});

export type CreateAgentInput = z.infer<typeof createAgentSchema>;
export type UpdateAgentInput = z.infer<typeof updateAgentSchema>;
export type KnowledgeFileInput = z.infer<typeof knowledgeFileSchema>;
export type CreateConversationInput = z.infer<typeof createConversationSchema>;
export type AgentChatInput = z.infer<typeof agentChatSchema>;
