import { z } from "zod";

export const chatMessageSchema = z.object({
  // A UUID in production; demo mode (no Supabase) accepts any id.
  projectId: z.string().min(1).max(100),
  content: z
    .string()
    .min(1, "Message cannot be empty")
    .max(8000, "Message must be at most 8,000 characters"),
});

export type ChatMessageInput = z.infer<typeof chatMessageSchema>;
