import type { GeneratedFile } from "@/lib/agents/types";
import { isAnyProviderConfigured, completeText } from "@/lib/ai/provider";
import { isNvidiaConfigured, nvidiaCodeModel, nvidiaGlmModel } from "@/lib/ai/nvidia";

/** Model used only if the opt-in Anthropic tier is ever reached. */
export const ANTHROPIC_AGENT_MODEL = "claude-opus-4-8";

/**
 * Label recorded against a build's usage row: the model the pipeline
 * actually starts on. NVIDIA is the default provider, so hardcoding a
 * Claude model here would have mislabelled every build.
 */
export function agentModel(): string {
  return isNvidiaConfigured() ? nvidiaGlmModel() : ANTHROPIC_AGENT_MODEL;
}

/**
 * What kind of work the agent call is doing — selects the NVIDIA model
 * used for the provider chain's primary tier: reasoning → GLM, code →
 * the code-specialized Laguna model.
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
 * The budget for the step currently running. Prefers the orchestrator's
 * per-step slice and falls back to the whole-pipeline deadline for
 * callers that run an agent outside the pipeline. No floor here — an
 * honest "almost no time left" is what lets `canCallModel` skip the
 * call rather than start one that is certain to be aborted.
 */
export function stepBudgetMs(context: {
  stepDeadlineAt?: number;
  deadlineAt?: number;
}): number {
  const deadlineAt = context.stepDeadlineAt ?? context.deadlineAt;
  if (!deadlineAt) return DEFAULT_TIMEOUT_MS;
  return Math.max(0, Math.min(DEFAULT_TIMEOUT_MS, deadlineAt - Date.now()));
}

/** Below this, no model call can realistically return in time. */
const MIN_LLM_BUDGET_MS = 6_000;

/**
 * Note for a step that skipped its model call because the build budget
 * was already spent. Empty when nothing is configured at all — that case
 * is demo mode, not a degraded build, and shouldn't read like one.
 */
export function outOfTimeNote(context: {
  stepDeadlineAt?: number;
  deadlineAt?: number;
}): string {
  return isLlmConfigured() && stepBudgetMs(context) < MIN_LLM_BUDGET_MS
    ? "no time left in the build budget"
    : "";
}

/**
 * Whether this step should call a model at all. False when nothing is
 * configured, and also when the step's slice is already spent — a
 * pipeline running late finishes on its deterministic scaffolds instead
 * of spending its last seconds on calls that will be aborted.
 */
export function canCallModel(context: {
  stepDeadlineAt?: number;
  deadlineAt?: number;
}): boolean {
  return isLlmConfigured() && stepBudgetMs(context) >= MIN_LLM_BUDGET_MS;
}

/**
 * Plain-language reason a step fell back to its built-in scaffold —
 * shown in the build log, so it has to say what actually went wrong
 * rather than "something failed".
 */
export function fallbackReason(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  if (/ran out of time|time budget|timed? ?out|abort/i.test(message)) {
    return "the model ran out of time";
  }
  if (/rate limit|429/i.test(message)) return "the model was rate-limited";
  if (/not found|404/i.test(message)) return "the configured model is unavailable";
  if (/authentication|401|403|api key/i.test(message)) {
    return "the NVIDIA API key was rejected";
  }
  return "the model call failed";
}

/**
 * Runs one agent LLM call through the centralized provider chain
 * (NVIDIA GLM → NVIDIA Step → NVIDIA Llama, plus Anthropic only when
 * explicitly enabled). Returns the final text.
 *
 * Bounded by `timeoutMs` (the orchestrator passes this step's slice of
 * the overall deadline): the six-agent pipeline shares one 300s Vercel
 * function budget, so a single step with no time limit of its own could
 * silently consume the whole thing and leave the platform to hard-kill
 * the request with no diagnosable error — exactly the "stuck waiting
 * indefinitely" failure this closes off. The budget covers the whole
 * provider chain, every model tier and retry included.
 *
 * `maxTokens` is the other half of that bound: output tokens are what
 * generation time is actually made of, so a step's cap has to be
 * something the step's time slice can realistically produce.
 */
export async function runAgentCompletion({
  system,
  prompt,
  maxTokens = 8000,
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
      anthropicModel: ANTHROPIC_AGENT_MODEL,
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
