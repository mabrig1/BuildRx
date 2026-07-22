import Anthropic from "@anthropic-ai/sdk";

import type { GeneratedFile } from "@/lib/agents/types";
import {
  createChatCompletion,
  isNvidiaConfigured,
  nvidiaCodeModel,
  nvidiaTextModel,
} from "@/lib/ai/nvidia";
import { withTimeout } from "@/lib/health/retry";

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

/** Default per-call budget when the orchestrator hasn't set a tighter one. */
const DEFAULT_TIMEOUT_MS = 90_000;

/**
 * Slices a shared pipeline deadline into a per-call budget: never less
 * than `floorMs` (so a step always gets a fair shot) and never more than
 * `ceilingMs` (so one step can't claim the whole remaining budget from
 * the ones after it).
 */
export function remainingBudgetMs(
  deadlineAt: number | undefined,
  floorMs = 10_000,
  ceilingMs = DEFAULT_TIMEOUT_MS
): number {
  if (!deadlineAt) return ceilingMs;
  return Math.max(floorMs, Math.min(ceilingMs, deadlineAt - Date.now()));
}

/**
 * Runs one agent LLM call. Prefers Anthropic Claude when configured
 * (streaming under the hood so long generations don't hit HTTP
 * timeouts); falls back to the NVIDIA Inference API with a role-matched
 * model. Returns the final text.
 *
 * Bounded by `timeoutMs` (the orchestrator passes the remaining slice of
 * its overall deadline): the six-agent pipeline shares one 300s Vercel
 * function budget, so a single step with no time limit of its own could
 * silently consume the whole thing and leave the platform to hard-kill
 * the request with no diagnosable error — exactly the "stuck waiting
 * indefinitely" failure this closes off.
 */
export async function runAgentCompletion({
  system,
  prompt,
  maxTokens = 16000,
  role = "reasoning",
  timeoutMs = DEFAULT_TIMEOUT_MS,
}: {
  system: string;
  prompt: string;
  maxTokens?: number;
  role?: AgentRole;
  timeoutMs?: number;
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

    let timedOut = false;
    const deadline = setTimeout(() => {
      timedOut = true;
      stream.abort();
    }, timeoutMs);

    try {
      const message = await stream.finalMessage();
      return message.content
        .filter((block) => block.type === "text")
        .map((block) => block.text)
        .join("");
    } catch (error) {
      if (timedOut) {
        throw new Error(
          `Agent LLM call exceeded its ${Math.round(timeoutMs / 1000)}s time budget.`
        );
      }
      throw error;
    } finally {
      clearTimeout(deadline);
    }
  }

  const model = role === "code" ? nvidiaCodeModel() : nvidiaTextModel();
  const result = await withTimeout(
    () =>
      createChatCompletion(
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
      ),
    timeoutMs,
    "NVIDIA agent completion"
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
