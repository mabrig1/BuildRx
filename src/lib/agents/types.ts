export type AgentName =
  | "planner"
  | "ui"
  | "database"
  | "coding"
  | "debug"
  | "deployment";

export const AGENT_ORDER: AgentName[] = [
  "planner",
  "ui",
  "database",
  "coding",
  "debug",
  "deployment",
];

export const AGENT_LABELS: Record<AgentName, string> = {
  planner: "Planner Agent",
  ui: "UI Agent",
  database: "Database Agent",
  coding: "Coding Agent",
  debug: "Debug Agent",
  deployment: "Deployment Agent",
};

/** Structured plan produced by the Planner Agent. */
export interface AppPlan {
  appName: string;
  summary: string;
  pages: Array<{ name: string; path: string; description: string }>;
  components: Array<{ name: string; description: string }>;
  dataModel: Array<{
    table: string;
    description: string;
    columns: Array<{ name: string; type: string }>;
  }>;
  features: string[];
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
}

/** Events streamed to the client as NDJSON. */
export type AgentEvent =
  | { type: "workflow_start"; agents: AgentName[] }
  | { type: "agent_start"; agent: AgentName; message: string }
  | { type: "agent_log"; agent: AgentName; message: string }
  | { type: "file"; agent: AgentName; path: string }
  | { type: "agent_complete"; agent: AgentName; message: string }
  | {
      type: "workflow_complete";
      previewUrl: string | null;
      fileCount: number;
    }
  | { type: "error"; agent?: AgentName; message: string };

export type EmitFn = (event: AgentEvent) => void;

export interface Agent {
  name: AgentName;
  run(context: WorkflowContext, emit: EmitFn): Promise<void>;
}
