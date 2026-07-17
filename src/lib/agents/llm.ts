import Anthropic from "@anthropic-ai/sdk";

import type { GeneratedFile } from "@/lib/agents/types";
import {
  createChatCompletion,
  isNvidiaConfigured,
  nvidiaCodeModel,
  nvidiaTextModel,
} from "@/lib/ai/nvidia";

export const AGENT_MODEL = "claude-opus-4-8";

/**
 * What kind of work the agent call is doing. With the NVIDIA provider
 * this selects the model: reasoning → the text model (GLM 5.2),
 * code → the code-specialized model (Laguna XS 2.1).
 */
export type AgentRole = "reasoning" | "code";

export function isLlmConfigured() {
  return Boolean(process.env.ANTHROPIC_API_KEY) || isNvidiaConfigured();
}

/**
 * Runs one agent LLM call. Prefers Anthropic Claude when configured
 * (streaming under the hood so long generations don't hit HTTP
 * timeouts); falls back to the NVIDIA Inference API with a role-matched
 * model. Returns the final text.
 */
export async function runAgentCompletion({
  system,
  prompt,
  maxTokens = 16000,
  role = "reasoning",
}: {
  system: string;
  prompt: string;
  maxTokens?: number;
  role?: AgentRole;
}): Promise<string> {
  if (process.env.ANTHROPIC_API_KEY) {
    const client = new Anthropic();
    const stream = client.messages.stream({
      model: AGENT_MODEL,
      max_tokens: maxTokens,
      thinking: { type: "adaptive" },
      system,
      messages: [{ role: "user", content: prompt }],
    });
    const message = await stream.finalMessage();
    return message.content
      .filter((block) => block.type === "text")
      .map((block) => block.text)
      .join("");
  }

  const model = role === "code" ? nvidiaCodeModel() : nvidiaTextModel();
  const result = await createChatCompletion(
    [
      { role: "system", content: system },
      { role: "user", content: prompt },
    ],
    {
      model,
      // Stay inside each model's completion window.
      maxTokens: Math.min(maxTokens, role === "code" ? 8192 : 16384),
      temperature: 0.3,
    }
  );
  return result.text;
}

/**
 * Extracts the first JSON object from LLM output (tolerates fencing
 * and surrounding prose).
 */
export function extractJson<T>(text: string): T {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidate = fenced ? fenced[1] : text;
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) {
    throw new Error("No JSON object found in agent output");
  }
  return JSON.parse(candidate.slice(start, end + 1)) as T;
}

/**
 * File-block wire format used by code-producing agents:
 *
 *   ===FILE: path/to/file.tsx===
 *   <content>
 *   ===END===
 */
export const FILE_FORMAT_INSTRUCTIONS = `Output every file using exactly this format, with no other prose between blocks:

===FILE: <relative/path>===
<file content>
===END===`;

export function parseFileBlocks(text: string): GeneratedFile[] {
  const files: GeneratedFile[] = [];
  const pattern = /===FILE:\s*(.+?)===\r?\n([\s\S]*?)\r?\n?===END===/g;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(text)) !== null) {
    const path = match[1].trim();
    if (isSafeFilePath(path)) {
      files.push({ path, content: match[2] });
    }
  }
  return files;
}

/** Rejects traversal, absolute paths, and oversized paths. */
export function isSafeFilePath(path: string): boolean {
  return (
    path.length > 0 &&
    path.length <= 200 &&
    !path.startsWith("/") &&
    !path.includes("..") &&
    !path.includes("\\") &&
    !path.includes("\0")
  );
}

/** Small pause so mock runs read as a live pipeline. */
export function pause(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
