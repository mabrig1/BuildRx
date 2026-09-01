import { classifyThrown } from "@/lib/health/error-response";
import type { CheckResult } from "@/lib/health/types";
import { getMongoDatabase } from "@/lib/mongodb/client";
import { isMongoConfigured } from "@/lib/mongodb/config";

/**
 * MongoDB owns resumable, document-shaped agent/build-run state. It is
 * deliberately not used for users, entitlements, project ownership, or
 * generated source files; those remain relational and RLS-scoped in
 * Supabase. The current request still executes inline, but its durable
 * state is available for recovery and later queue extraction.
 */
export async function checkBackgroundJobs(): Promise<{ result: CheckResult }> {
  const startedAt = Date.now();
  const checkedAt = new Date().toISOString();

  if (!isMongoConfigured()) {
    return {
      result: {
        subsystem: "jobs",
        label: "Durable workflow state",
        status: "degraded",
        summary:
          "MONGODB_URI is not set — builds run inline without durable agent-run checkpoints.",
        detail: { mongoConfigured: false, execution: "inline" },
        checkedAt,
        durationMs: Date.now() - startedAt,
      },
    };
  }

  try {
    const database = await getMongoDatabase();
    await database.command({ ping: 1 });
    return {
      result: {
        subsystem: "jobs",
        label: "Durable workflow state",
        status: "healthy",
        summary: "MongoDB reachable; agent/build-run checkpoints are durable.",
        detail: {
          mongoConfigured: true,
          execution: "inline",
          collection: "build_runs",
        },
        checkedAt,
        durationMs: Date.now() - startedAt,
      },
    };
  } catch (error) {
    const diagnosed = classifyThrown(error, "jobs");
    return {
      result: {
        subsystem: "jobs",
        label: "Durable workflow state",
        status: "degraded",
        summary: "MongoDB is configured but unreachable; builds continue without checkpoints.",
        detail: { mongoConfigured: true, code: diagnosed.code },
        checkedAt,
        durationMs: Date.now() - startedAt,
      },
    };
  }
}
