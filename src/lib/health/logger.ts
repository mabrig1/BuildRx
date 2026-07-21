import type { Json, LogLevel } from "@/types/database";

import type { Subsystem } from "@/lib/health/types";
import { isSupabaseConfigured } from "@/lib/supabase/config";

export interface LogEntry {
  level: LogLevel;
  source: string;
  message: string;
  code?: string;
  subsystem?: Subsystem;
  context?: Record<string, unknown>;
  stack?: string;
}

/**
 * Structured logger (Debug Agent). Always logs to the console; also
 * persists to `system_logs` when Supabase is configured, so the
 * health dashboard has an error history. Persistence is best-effort —
 * a logging failure must never break the request that triggered it.
 */
export async function log(entry: LogEntry): Promise<void> {
  const consoleMethod =
    entry.level === "error"
      ? console.error
      : entry.level === "warn"
        ? console.warn
        : console.log;
  consoleMethod(`[${entry.source}] ${entry.message}`, entry.context ?? "");

  if (!isSupabaseConfigured()) return;

  try {
    const { createAdminClient } = await import("@/lib/supabase/admin");
    const supabase = createAdminClient();
    await supabase.from("system_logs").insert({
      level: entry.level,
      source: entry.source,
      message: entry.message,
      code: entry.code ?? null,
      subsystem: entry.subsystem ?? null,
      context: (entry.context ?? {}) as unknown as Json,
      stack: entry.stack ?? null,
    });
  } catch (error) {
    // Logging must be fire-and-forget: never let a logging failure
    // mask or replace the original error.
    console.error("[health] failed to persist system_logs entry", error);
  }
}

export function logError(
  source: string,
  message: string,
  options?: {
    code?: string;
    subsystem?: Subsystem;
    context?: Record<string, unknown>;
    stack?: string;
  }
): Promise<void> {
  return log({ level: "error", source, message, ...options });
}

export function logWarn(
  source: string,
  message: string,
  options?: { code?: string; subsystem?: Subsystem; context?: Record<string, unknown> }
): Promise<void> {
  return log({ level: "warn", source, message, ...options });
}

export function logInfo(
  source: string,
  message: string,
  options?: { subsystem?: Subsystem; context?: Record<string, unknown> }
): Promise<void> {
  return log({ level: "info", source, message, ...options });
}

/** Recent log entries for the health dashboard's error history panel. */
export async function getRecentLogs(limit = 50) {
  if (!isSupabaseConfigured()) return [];
  const { createAdminClient } = await import("@/lib/supabase/admin");
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("system_logs")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) {
    console.error("[health] failed to load system_logs", error);
    return [];
  }
  return data ?? [];
}
