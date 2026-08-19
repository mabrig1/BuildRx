export type AgentName =
  | "planner"
  | "architect"
  | "ui"
  | "database"
  | "coding"
  | "debug"
  | "security"
  | "qa"
  | "repair"
  | "deployment";

/**
 * Pipeline order. The orchestrator (runWorkflow) coordinates these ten:
 * generation (planner → architect → ui → database → coding), review
 * (debug → security), then verification with an autonomous repair loop
 * (qa finds issues → repair fixes → qa retests, bounded), and finally
 * deployment, which persists files and verifies the preview.
 */
export const AGENT_ORDER: AgentName[] = [
  "planner",
  "architect",
  "ui",
  "database",
  "coding",
  "debug",
  "security",
  "qa",
  "repair",
  "deployment",
];

export const AGENT_LABELS: Record<AgentName, string> = {
  planner: "Planner Agent",
  architect: "Architect Agent",
  ui: "UI Agent",
  database: "Database Agent",
  coding: "Coding Agent",
  debug: "Debugging Agent",
  security: "Security Agent",
  qa: "QA/Test Agent",
  repair: "Repair Agent",
  deployment: "Deployment Agent",
};

/** Structured plan produced by the Planner Agent. */
export interface AppPlan {
  appName: string;
  summary: string;
  /** People who use the product and the authority each one has. */
  userRoles?: Array<{ name: string; permissions: string[] }>;
  /** End-to-end jobs the generated product must actually complete. */
  workflows?: Array<{
    name: string;
    actor: string;
    steps: string[];
    outcome: string;
  }>;
  pages: Array<{ name: string; path: string; description: string }>;
  components: Array<{ name: string; description: string }>;
  dataModel: Array<{
    table: string;
    description: string;
    columns: Array<{ name: string; type: string }>;
  }>;
  features: string[];
  /** Observable conditions used by QA to judge whether this is a product, not a mock-up. */
  acceptanceCriteria?: string[];
  qualityRequirements?: string[];
}

export interface GeneratedFile {
  path: string;
  content: string;
}

/** Shared state that flows through the pipeline. */
export interface WorkflowContext {
  projectId: string;
  userId: string | null;
  prompt: string;
  /** Whether Supabase persistence is available. */
  persist: boolean;
  plan?: AppPlan;
  /** Accumulated generated files, keyed by path (later agents may revise). */
  files: Map<string, GeneratedFile>;
  previewUrl?: string;
  /**
   * Absolute timestamp (ms) the whole pipeline must finish by, set once
   * by the orchestrator. Agents divide their remaining slice of it
   * across their own LLM calls so six sequential steps share one
   * Vercel function's duration budget instead of each assuming they
   * have the whole thing to themselves.
   */
  deadlineAt?: number;
  /**
   * Deadline for the step currently running — the orchestrator's split
   * of `deadlineAt` across the steps that remain. Agents bound their LLM
   * calls by this, so a slow step can't eat the budget of the ones after
   * it (which is what used to strand a build mid-pipeline).
   */
  stepDeadlineAt?: number;
  /**
   * Architect Agent's notes: stack decisions and a file map the
   * generating agents follow so their output fits together.
   */
  architecture?: string;
  /** Open findings from the QA Agent, consumed by the Repair Agent. */
  findings?: CheckFinding[];
  /** Final deployment gate; false means files were saved but the app is not releasable. */
  verified?: boolean;
  /** Correlates every event and log line of one build run. */
  requestId?: string;
}

/** One issue found by the QA/Security check suite. */
export interface CheckFinding {
  /** Stable id of the rule that fired, e.g. "missing-import". */
  rule: string;
  severity: "error" | "warning";
  file?: string;
  message: string;
  /**
   * How the Repair Agent can act on it: "auto" (deterministic fix),
   * "llm" (needs a model rewrite of the file), "none" (report only).
   */
  fix: "auto" | "llm" | "none";
}

/** One line of the final verification checklist. */
export interface VerificationItem {
  label: string;
  status: "pass" | "warn" | "fail";
  detail?: string;
}

/** Events streamed to the client as NDJSON. */
export type AgentEvent =
  | { type: "workflow_start"; agents: AgentName[] }
  | { type: "verification"; agent: AgentName; items: VerificationItem[] }
  /**
   * Emitted every few seconds while a step is working. A build can spend
   * a minute inside one model call; without a signal in between, a
   * silent connection and a working one look identical to the client
   * (and to the user, who sees "Thinking…" forever). `requestId` ties
   * every event of one run together in the logs.
   */
  | {
      type: "heartbeat";
      agent: AgentName;
      requestId: string;
      elapsedMs: number;
      /** Whole-pipeline budget remaining, so the UI can show a bound. */
      remainingMs: number;
    }
  | { type: "agent_start"; agent: AgentName; message: string }
  | { type: "agent_log"; agent: AgentName; message: string }
  | { type: "file"; agent: AgentName; path: string }
  | { type: "agent_complete"; agent: AgentName; message: string }
  /**
   * A step produced something, but not what it was meant to — most often
   * a model call that failed, leaving the built-in scaffold in its
   * place. The build continues, so this is not an `error`; but it is the
   * difference between a generated app and a template, and the user has
   * to be told which one they got and why. Omit `agent` for a
   * whole-build condition (nothing configured at all).
   */
  | {
      type: "agent_degraded";
      agent?: AgentName;
      /** What the build lost, in plain language. */
      message: string;
      code: string;
      /** The provider's own error, verbatim. */
      cause: string;
      suggestedFix: string;
      /** Whether re-running alone could succeed. */
      retryable: boolean;
    }
  | {
      type: "workflow_complete";
      previewUrl: string | null;
      fileCount: number;
      verified: boolean;
    }
  | {
      type: "error";
      agent?: AgentName;
      message: string;
      /** Set when the error was classified (see lib/health/error-response) — a machine code, exact cause, and next step, instead of a generic message. */
      code?: string;
      cause?: string;
      suggestedFix?: string;
    };

export type EmitFn = (event: AgentEvent) => void;

export interface Agent {
  name: AgentName;
  run(context: WorkflowContext, emit: EmitFn): Promise<void>;
}
