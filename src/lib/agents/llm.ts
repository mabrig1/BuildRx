import Anthropic from "@anthropic-ai/sdk";

import type { GeneratedFile } from "@/lib/agents/types";

export const AGENT_MODEL = "claude-opus-4-8";

export function isLlmConfigured() {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

/**
 * Runs one agent LLM call. Uses streaming under the hood so long
 * generations don't hit HTTP timeouts; returns the final text.
 */
export async function runAgentCompletion({
  system,
  prompt,
  maxTokens = 16000,
}: {
  system: string;
  prompt: string;
  maxTokens?: number;
}): Promise<string> {
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
