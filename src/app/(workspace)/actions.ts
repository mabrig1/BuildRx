"use server";

import { z } from "zod";

import { createClient } from "@/lib/supabase/server";
import { MAX_AI_PROMPT_CHARACTERS } from "@/lib/validations/limits";

const editMessageSchema = z.object({
  messageId: z.string().uuid(),
  content: z.string().min(1).max(MAX_AI_PROMPT_CHARACTERS),
});

type ActionResult = { error: string } | { success: true };

/** Edit one of the user's own chat messages. */
export async function updateChatMessage(input: {
  messageId: string;
  content: string;
}): Promise<ActionResult> {
  const parsed = editMessageSchema.safeParse(input);
  if (!parsed.success) {
    return { error: "Message cannot be empty." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: "You must be signed in." };
  }

  // RLS restricts this to the user's own messages in their own projects.
  const { error } = await supabase
    .from("chat_messages")
    .update({ content: parsed.data.content })
    .eq("id", parsed.data.messageId);

  if (error) {
    return { error: error.message };
  }
  return { success: true };
}
