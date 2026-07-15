import { z } from "zod";

export const chatMessageSchema = z.object({
  projectId: z.string().uuid(),
  content: z
    .string()
    .min(1, "Message cannot be empty")
    .max(8000, "Message must be at most 8,000 characters"),
});

export type ChatMessageInput = z.infer<typeof chatMessageSchema>;
