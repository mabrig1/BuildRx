import type {
  AgentEvent,
  AgentName,
  GeneratedFile,
} from "@/lib/agents/types";
import {
  resolveGeneralFallbackModel,
  resolveModelForRole,
  type ModelRole,
} from "@/lib/ai/models";
import { isAnyProviderConfigured, completeText } from "@/lib/ai/provider";
import { isNvidiaConfigured, nvidiaGlmModel } from "@/lib/ai/nvidia";

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
 * What kind of work the agent call is doing — routed to the NVIDIA model
 * suited to it (see lib/ai/models.ts). Re-exported so agents declare a
 * role, not a model id.
 */
export type AgentRole = ModelRole;

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
  return Math.floor(Math.max(floorMs, Math.min(ceilingMs, deadlineAt - Date.now())));
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
  return Math.floor(Math.max(0, Math.min(DEFAULT_TIMEOUT_MS, deadlineAt - Date.now())));
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
 * Why a step fell back to its built-in scaffold, in enough detail to act
 * on.
 *
 * The provider chain already builds a precise error ("All AI providers
 * failed. Tried: … Last error: …"), and every bit of it used to be
 * thrown away in favour of a six-word phrase — which is why a degraded
 * build read as "the model call failed" with no way to find out why or
 * what to do about it. `cause` carries the provider's own words
 * verbatim; `suggestedFix` is the concrete next action.
 */
export interface ModelFailure {
  /** Short phrase for the inline build-log note. */
  summary: string;
  /** Stable machine code, e.g. AI_TIMEOUT. */
  code: string;
  /** The underlying error, verbatim — never summarised away. */
  cause: string;
  /** What the user should actually do. */
  suggestedFix: string;
  /** Whether re-running the build alone could succeed. */
  retryable: boolean;
}

/**
 * Ordered: the first pattern that matches wins, so a message mentioning
 * both a rate limit and a timeout is reported as the timeout that
 * actually stopped it.
 */
const FAILURE_PATTERNS: ReadonlyArray<
  Omit<ModelFailure, "cause"> & { test: RegExp }
> = [
  {
    test: /no ai provider is configured|is not configured/i,
    summary: "no AI provider is configured",
    code: "AI_NOT_CONFIGURED",
    suggestedFix:
      "Set NVIDIA_API_KEY in your deployment environment (a free key is available at build.nvidia.com) and redeploy. Until then every build falls back to built-in scaffolds instead of generating code.",
    retryable: false,
  },
  {
    test: /ran out of time|time budget|timed? ?out|abort|returned nothing within/i,
    summary: "the model ran out of time",
    code: "AI_TIMEOUT",
    suggestedFix:
      "The model did not answer within this step's share of the build budget. Re-run the build, describe a smaller app, or raise AGENT_PIPELINE_BUDGET_MS if your host allows longer function runs.",
    retryable: true,
  },
  {
    test: /rate limit|429/i,
    summary: "the model was rate-limited",
    code: "AI_RATE_LIMITED",
    suggestedFix:
      "The provider is throttling this API key. Wait a minute, then run the build again.",
    retryable: true,
  },
  {
    test: /not found|404/i,
    summary: "the configured model is unavailable",
    code: "AI_MODEL_UNAVAILABLE",
    suggestedFix:
      "The model id this deployment asks for is not available to your key. Clear the NVIDIA_MODEL_* variables to fall back to the built-in defaults, or set them to an id listed by /api/ai/models.",
    retryable: false,
  },
  {
    test: /authentication|401|403|api key/i,
    summary: "the NVIDIA API key was rejected",
    code: "AI_KEY_REJECTED",
    suggestedFix:
      "NVIDIA_API_KEY was rejected. Check it has not expired and was pasted without stray spaces or newlines, then redeploy.",
    retryable: false,
  },
];

/** Full diagnosis of a failed model call. */
export function diagnoseModelFailure(error: unknown): ModelFailure {
  const cause =
    error instanceof Error ? error.message : String(error ?? "unknown error");
  const matched = FAILURE_PATTERNS.find((pattern) => pattern.test.test(cause));
  if (matched) {
    return {
      summary: matched.summary,
      code: matched.code,
      cause,
      suggestedFix: matched.suggestedFix,
      retryable: matched.retryable,
    };
  }
  return {
    summary: "the model call failed",
    code: "AI_CALL_FAILED",
    cause,
    suggestedFix:
      "Re-run the build — this step fell back to its built-in scaffold, so the app still renders. If it keeps happening, the provider's own error is shown above.",
    retryable: true,
  };
}

/**
 * The model answered, but produced nothing the pipeline could use — a
 * distinct case from a failed call, and one the user can act on
 * differently.
 */
export function emptyOutputFailure(detail: string): ModelFailure {
  return {
    summary: "the model returned no usable output",
    code: "AI_EMPTY_OUTPUT",
    cause: detail,
    suggestedFix:
      "The model replied, but nothing in the response could be used. Re-run the build; if it repeats, describe the app in smaller, more concrete steps.",
    retryable: true,
  };
}

/**
 * Plain-language reason a step fell back to its built-in scaffold —
 * shown inline in the build log next to the step's result.
 */
export function fallbackReason(error: unknown): string {
  return diagnoseModelFailure(error).summary;
}

/**
 * The build-log event for a step that produced something, but not what
 * it was supposed to. Distinct from an `error`, which ends the run.
 */
export function degradedEvent(
  agent: AgentName | undefined,
  message: string,
  failure: ModelFailure
): AgentEvent {
  return {
    type: "agent_degraded",
    ...(agent ? { agent } : {}),
    message,
    code: failure.code,
    cause: failure.cause,
    suggestedFix: failure.suggestedFix,
    retryable: failure.retryable,
  };
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
  role = "deep-reasoning",
  timeoutMs = DEFAULT_TIMEOUT_MS,
}: {
  system: string;
  prompt: string;
  maxTokens?: number;
  role?: AgentRole;
  timeoutMs?: number;
}): Promise<string> {
  // Route by task complexity (see lib/ai/models.ts): the strongest
  // model for this role that the configured key can actually call,
  // with a general-purpose model as the chain's second tier.
  // The step's actual budget decides the ladder: a large reasoning model
  // that needs most of a minute to start answering is the wrong choice
  // for a slice that is under one, however capable it is.
  const [nvidiaModel, nvidiaFallbackModel] = await Promise.all([
    resolveModelForRole(role, timeoutMs),
    resolveGeneralFallbackModel(timeoutMs),
  ]);

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
      nvidiaModel,
      nvidiaFallbackModel,
    }
  );
  return result.text;
}

/**
 * Closers still owed by a partial JSON string, outermost last. Quotes
 * and escapes are tracked so braces inside string values don't count.
 */
function pendingClosers(json: string): string[] {
  const stack: string[] = [];
  let inString = false;
  let escaped = false;

  for (const char of json) {
    if (inString) {
      if (escaped) escaped = false;
      else if (char === "\\") escaped = true;
      else if (char === '"') inString = false;
      continue;
    }
    if (char === '"') inString = true;
    else if (char === "{") stack.push("}");
    else if (char === "[") stack.push("]");
    else if (char === "}" || char === "]") stack.pop();
  }
  if (inString) stack.push('"');
  return stack;
}

/**
 * Rebuilds a JSON object that was cut off mid-generation (the model hit
 * its token ceiling). Drops back to the last completed element and
 * closes what's still open, which turns "Expected ',' or ']' after array
 * element at position 1301" into a slightly shorter but usable plan.
 * Returns null when there's no complete element to fall back to.
 */
function repairTruncatedJson(json: string): string | null {
  let inString = false;
  let escaped = false;
  let lastComplete = -1;

  for (let i = 0; i < json.length; i++) {
    const char = json[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (char === "\\") escaped = true;
      else if (char === '"') inString = false;
      continue;
    }
    if (char === '"') inString = true;
    // A closing bracket or a comma marks a point the value before it was
    // whole — the furthest such point is the most content we can keep.
    else if (char === "}" || char === "]") lastComplete = i + 1;
    else if (char === ",") lastComplete = i;
  }

  if (lastComplete <= 0) return null;
  const head = json.slice(0, lastComplete).replace(/,\s*$/, "");
  const closers = pendingClosers(head).reverse().join("");
  return closers ? head + closers : head;
}

/**
 * Extracts the first JSON object from LLM output (tolerates fencing,
 * surrounding prose, reasoning-model <think> blocks, and a response
 * truncated by the token ceiling).
 */
export function extractJson<T>(text: string): T {
  // Reasoning models emit their scratchpad first; it routinely contains
  // braces and draft JSON that would otherwise be parsed as the answer.
  const withoutThinking = text.replace(/<(think|thinking|reasoning)>[\s\S]*?<\/\1>/gi, "");
  const fenced = withoutThinking.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidate = fenced ? fenced[1] : withoutThinking;
  const start = candidate.indexOf("{");
  if (start === -1) {
    throw new Error("No JSON object found in agent output");
  }

  const end = candidate.lastIndexOf("}");
  if (end > start) {
    try {
      return JSON.parse(candidate.slice(start, end + 1)) as T;
    } catch {
      // fall through to the repair attempt
    }
  }

  const repaired = repairTruncatedJson(candidate.slice(start));
  if (repaired) {
    try {
      return JSON.parse(repaired) as T;
    } catch {
      // fall through to the shared error below
    }
  }
  throw new Error(
    "The model's response was not valid JSON and could not be repaired (it was most likely cut off mid-answer)."
  );
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
