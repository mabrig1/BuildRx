/**
 * Document/image parsing service — structured text and metadata
 * extraction from images (specs, mockups with annotations, screenshots
 * of forms) via the NVIDIA Inference API (Nemotron Parse by default).
 * Shares the vision pipeline; only the model and default prompt differ.
 */

import { createChatCompletion, nvidiaParseModel } from "@/lib/ai/nvidia";
import type { NvidiaMessage } from "@/lib/ai/nvidia";

const DEFAULT_PROMPT =
  "Extract all visible text and structured data (labels, tables, " +
  "key-value fields, form fields) from this image. Return it as clean, " +
  "well-organized markdown that preserves the original structure.";

export async function extractDocument({
  imageDataUrl,
  prompt,
  model,
}: {
  imageDataUrl: string;
  prompt?: string;
  model?: string;
}) {
  const messages: NvidiaMessage[] = [
    {
      role: "user",
      content: [
        { type: "text", text: prompt?.trim() || DEFAULT_PROMPT },
        { type: "image_url", image_url: { url: imageDataUrl } },
      ],
    },
  ];

  return createChatCompletion(messages, {
    model: model ?? nvidiaParseModel(),
    maxTokens: 4096,
    temperature: 0.1,
  });
}
