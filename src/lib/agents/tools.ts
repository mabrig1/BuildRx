/**
 * Tool-execution layer for the agent pipeline.
 *
 * Agents don't get a shell. Every operation they can perform on the
 * project is a typed tool in this file, operating on the build's virtual
 * filesystem (WorkflowContext.files) with hard limits on writes, sizes,
 * and file counts — the same posture as the rest of the pipeline: an
 * agent can degrade a build, never the platform.
 *
 * Design note: tools are invoked programmatically by the QA, Security,
 * and Repair agents rather than via model function-calling. NIM models
 * vary in tool-call support, and a malformed tool call mid-build would
 * be one more thing to repair; deterministic invocation with the tool
 * *results* fed into prompts is more reliable and cheaper. The model's
 * output stays in the one format every agent already parses (FILE
 * blocks), and this layer applies it under the limits below.
 *
 * Boundaries (deliberate, documented for reviewers):
 * - "Run builds/tests" means the static verification suite in
 *   checks.ts. A real `npm install && next build` of the generated app
 *   cannot run inside a serverless function; the WebContainer preview
 *   performs the real install/build client-side, and the static suite
 *   catches the failure classes LLM codegen actually produces (missing
 *   imports, broken structure, invalid JSON, uncovered routes).
 * - Git push and external deploys stay user-triggered (existing
 *   /api/github/push and deploy panel, using per-user tokens). The
 *   pipeline never pushes to a user's repo or provider on its own.
 * - Migrations are written as files into the generated project; they
 *   are never executed against BuildRx's own database.
 */
import { isSafeFilePath } from "@/lib/agents/llm";
import type { GeneratedFile, WorkflowContext } from "@/lib/agents/types";

/** Hard caps for one pipeline run — shared across all tool-using agents. */
export const TOOL_LIMITS = {
  /** Total files the VFS may hold. */
  maxFiles: 120,
  /** Max size of a single written file. */
  maxFileBytes: 200_000,
  /** Total tool writes (create/edit/delete) per run. */
  maxWritesPerRun: 80,
  /**
   * Repair loop iterations (fix → retest). Override with
   * MAX_REPAIR_ATTEMPTS. Bounded on both sides: zero would disable
   * self-repair, and an unbounded value would let a build spend its
   * whole time budget re-running the same failing fix.
   */
  maxRepairRounds: (() => {
    const configured = Number(process.env.MAX_REPAIR_ATTEMPTS);
    return Number.isFinite(configured) && configured >= 1 && configured <= 10
      ? Math.floor(configured)
      : 5;
  })(),
  /** Timeout for the deployment self-verification fetch. */
  verifyFetchTimeoutMs: 8_000,
} as const;

export class ToolLimitError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ToolLimitError";
  }
}

/** Per-run mutable counters, carried on the context via a WeakMap. */
const writeCounts = new WeakMap<WorkflowContext, number>();

function bumpWrites(context: WorkflowContext) {
  const used = (writeCounts.get(context) ?? 0) + 1;
  if (used > TOOL_LIMITS.maxWritesPerRun) {
    throw new ToolLimitError(
      `Write limit reached (${TOOL_LIMITS.maxWritesPerRun} per build).`
    );
  }
  writeCounts.set(context, used);
}

/** List every file path in the build. */
export function listFiles(context: WorkflowContext): string[] {
  return [...context.files.keys()].sort();
}

/** Read one file, or null when it doesn't exist. */
export function readFile(
  context: WorkflowContext,
  path: string
): GeneratedFile | null {
  return context.files.get(path) ?? null;
}

/** Create or overwrite one file, enforcing path safety and size limits. */
export function writeFile(
  context: WorkflowContext,
  path: string,
  content: string
): void {
  if (!isSafeFilePath(path)) {
    throw new ToolLimitError(`Unsafe file path rejected: ${path}`);
  }
  if (content.length > TOOL_LIMITS.maxFileBytes) {
    throw new ToolLimitError(
      `File too large (${content.length} bytes > ${TOOL_LIMITS.maxFileBytes}): ${path}`
    );
  }
  if (!context.files.has(path) && context.files.size >= TOOL_LIMITS.maxFiles) {
    throw new ToolLimitError(`File limit reached (${TOOL_LIMITS.maxFiles}).`);
  }
  bumpWrites(context);
  context.files.set(path, { path, content });
}

/** Delete one file (no error if absent — deletes are idempotent). */
export function deleteFile(context: WorkflowContext, path: string): void {
  if (!context.files.has(path)) return;
  bumpWrites(context);
  context.files.delete(path);
}

/** Tables parsed from the generated schema.sql (name only, lowercase). */
export function inspectSchema(context: WorkflowContext): string[] {
  const schema = context.files.get("supabase/schema.sql")?.content ?? "";
  const tables: string[] = [];
  const pattern = /create\s+table\s+(?:if\s+not\s+exists\s+)?(?:"?(?:public"?\.)?)?"?([a-z0-9_]+)"?/gi;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(schema)) !== null) {
    tables.push(match[1].toLowerCase());
  }
  return tables;
}

/**
 * Ensure a dependency is listed in the generated package.json. The real
 * install happens client-side in the WebContainer preview; being listed
 * is what makes that install pull it.
 */
export function ensureDependency(
  context: WorkflowContext,
  name: string,
  version = "latest"
): boolean {
  const file = context.files.get("package.json");
  if (!file) return false;
  let pkg: { dependencies?: Record<string, string> };
  try {
    pkg = JSON.parse(file.content);
  } catch {
    return false;
  }
  pkg.dependencies = pkg.dependencies ?? {};
  if (pkg.dependencies[name]) return true;
  pkg.dependencies[name] = version;
  writeFile(context, "package.json", `${JSON.stringify(pkg, null, 2)}\n`);
  return true;
}

/**
 * Recent diagnosed errors for this project from the platform's own log
 * table — lets the Debugging Agent see what actually failed in earlier
 * runs, not just this one. Connected mode only; demo mode has no store.
 */
export async function recentProjectLogs(
  projectId: string,
  limit = 5
): Promise<Array<{ message: string; createdAt: string }>> {
  const { isSupabaseConfigured } = await import("@/lib/supabase/config");
  if (!isSupabaseConfigured()) return [];
  try {
    const { createClient } = await import("@/lib/supabase/server");
    const supabase = await createClient();
    const { data } = await supabase
      .from("system_logs")
      .select("message, created_at")
      .contains("context", { projectId })
      .order("created_at", { ascending: false })
      .limit(limit);
    return (data ?? []).map((row: { message: string; created_at: string }) => ({
      message: row.message,
      createdAt: row.created_at,
    }));
  } catch {
    return [];
  }
}

/**
 * Fetch the published preview from the outside, the way a browser
 * would — the only honest server-side check that "the preview renders".
 * Returns null when no base URL is known (nothing to fetch against).
 */
export async function verifyPreviewResponds(
  projectId: string
): Promise<{ ok: boolean; detail: string } | null> {
  const base =
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "");
  if (!base) return null;

  try {
    const response = await fetch(`${base.replace(/\/$/, "")}/api/preview/${projectId}`, {
      signal: AbortSignal.timeout(TOOL_LIMITS.verifyFetchTimeoutMs),
      headers: { Accept: "text/html" },
    });
    if (!response.ok) {
      return { ok: false, detail: `preview returned HTTP ${response.status}` };
    }
    const html = await response.text();
    return html.includes("<html")
      ? { ok: true, detail: "preview responds with HTML" }
      : { ok: false, detail: "preview responded but not with an HTML document" };
  } catch (error) {
    return {
      ok: false,
      detail: error instanceof Error ? error.message : "preview fetch failed",
    };
  }
}
