import type { GeneratedFile } from "@/lib/agents/types";
import { isAnyProviderConfigured, completeText } from "@/lib/ai/provider";
import { nvidiaCodeModel } from "@/lib/ai/nvidia";

export const AGENT_MODEL = "claude-opus-4-8";

/**
 * What kind of work the agent call is doing — selects the NVIDIA model
 * used for the provider chain's "nvidia-glm" tier when that provider is
 * reached: reasoning → GLM, code → the code-specialized Laguna model.
 */
export type AgentRole = "reasoning" | "code";

export function isLlmConfigured() {
  return isAnyProviderConfigured();
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
 * Runs one agent LLM call through the centralized provider chain (NVIDIA
 * GLM → NVIDIA Llama → Anthropic Claude, whichever are configured).
 * Returns the final text.
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
  const result = await completeText(
    [
      { role: "system", content: system },
      { role: "user", content: prompt },
    ],
    {
      maxTokens,
      temperature: 0.3,
      timeoutMs,
      anthropicModel: AGENT_MODEL,
      // Keep the code-specialized NVIDIA model for code-generating
      // agents; the GLM default covers planning/review/reasoning steps.
      nvidiaModel: role === "code" ? nvidiaCodeModel() : undefined,
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
