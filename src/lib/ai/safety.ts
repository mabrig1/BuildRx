/**
 * Content-safety service — classifies text as safe/unsafe via the
 * NVIDIA Inference API's Nemotron Safety Guard model, used to moderate
 * both user prompts and (optionally) generated output before it's
 * shown or persisted.
 */

import { createChatCompletion, nvidiaSafetyModel } from "@/lib/ai/nvidia";
import type { NvidiaMessage } from "@/lib/ai/nvidia";

export interface ModerationResult {
  safe: boolean;
  categories: string[];
  model: string;
}

const SAFETY_SYSTEM_PROMPT = [
  "You are a content safety classifier for a coding assistant app.",
  "Classify the user's message. Respond with exactly two lines and nothing else:",
  "Response Safety: safe|unsafe",
  'Safety Categories: <comma-separated categories, or "None">',
].join("\n");

/**
 * Classifies a single piece of text. Throws NvidiaApiError on
 * transport/API failure — callers should decide whether to fail open
 * (allow the message through) or closed based on their own risk
 * tolerance; this function never silently swallows errors.
 */
export async function moderateContent(
  text: string,
  model?: string
): Promise<ModerationResult> {
  const messages: NvidiaMessage[] = [
    { role: "system", content: SAFETY_SYSTEM_PROMPT },
    { role: "user", content: text },
  ];

  const result = await createChatCompletion(messages, {
    model: model ?? nvidiaSafetyModel(),
    maxTokens: 200,
    temperature: 0,
  });

  const safetyMatch = /response safety:\s*(safe|unsafe)/i.exec(result.text);
  const categoriesMatch = /safety categories:\s*(.+)/i.exec(result.text);

  const safe = safetyMatch
    ? safetyMatch[1].toLowerCase() === "safe"
    : !/unsafe/i.test(result.text);

  const categories = categoriesMatch
    ? categoriesMatch[1]
        .split(",")
        .map((c) => c.trim())
        .filter((c) => c.length > 0 && c.toLowerCase() !== "none")
    : [];

  return { safe, categories, model: result.model };
}
