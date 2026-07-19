/**
 * Vision-language service — image/screenshot understanding via the
 * NVIDIA Inference API's multimodal chat completions (Nemotron Nano
 * 12B v2 VL by default). Used for screenshot-to-spec ("image to code")
 * and for describing user-attached images in chat.
 */

import { createChatCompletion, nvidiaVisionModel } from "@/lib/ai/nvidia";
import type { NvidiaMessage } from "@/lib/ai/nvidia";

const DEFAULT_PROMPT =
  "Describe this UI screenshot or design in detail — layout, components, " +
  "colors, spacing, and any visible text. Write it as a clear spec an " +
  "engineer could use to rebuild it as a web page.";

export async function describeImage({
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
    model: model ?? nvidiaVisionModel(),
    maxTokens: 2048,
    temperature: 0.3,
  });
}
