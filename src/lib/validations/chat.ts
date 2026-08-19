import { z } from "zod";

import { MAX_AI_PROMPT_CHARACTERS } from "@/lib/validations/limits";

export const chatMessageSchema = z.object({
  // A UUID in production; demo mode (no Supabase) accepts any id.
  projectId: z.string().min(1).max(100),
  content: z
    .string()
    .min(1, "Message cannot be empty")
    .max(
      MAX_AI_PROMPT_CHARACTERS,
      `Message must be at most ${MAX_AI_PROMPT_CHARACTERS.toLocaleString()} characters`
    ),
});

export type ChatMessageInput = z.infer<typeof chatMessageSchema>;
