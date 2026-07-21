import { classifyThrown } from "@/lib/health/error-response";
import { withRetry } from "@/lib/health/retry";
import type { CheckResult, HealthStatus } from "@/lib/health/types";
import { isSupabaseConfigured } from "@/lib/supabase/config";

/**
 * Storage Agent: confirms Supabase Storage is reachable and reports
 * what buckets exist. No fix proposals — bucket creation is a
 * one-time setup step, not a self-healing repair.
 */
export async function checkStorage(): Promise<{ result: CheckResult }> {
  const startedAt = Date.now();
  const checkedAt = new Date().toISOString();

  if (!isSupabaseConfigured()) {
    return {
      result: {
        subsystem: "storage",
        label: "Storage",
        status: "degraded",
        summary: "Running in demo mode — Supabase Storage is not configured.",
        checkedAt,
        durationMs: Date.now() - startedAt,
      },
    };
  }

  try {
    const { createAdminClient } = await import("@/lib/supabase/admin");
    const supabase = createAdminClient();
    const { data, error } = await withRetry(() => supabase.storage.listBuckets(), {
      attempts: 2,
    });
    if (error) throw error;

    const buckets = data ?? [];
    const status: HealthStatus = "healthy";
    const summary =
      buckets.length === 0
        ? "Storage reachable — no buckets created yet."
        : `Storage reachable — ${buckets.length} bucket(s): ${buckets.map((b) => b.name).join(", ")}.`;

    return {
      result: {
        subsystem: "storage",
        label: "Storage",
        status,
        summary,
        detail: { buckets: buckets.map((b) => ({ name: b.name, public: b.public })) },
        checkedAt,
        durationMs: Date.now() - startedAt,
      },
    };
  } catch (error) {
    const diagnosed = classifyThrown(error, "storage");
    return {
      result: {
        subsystem: "storage",
        label: "Storage",
        status: "down",
        summary: diagnosed.message,
        detail: { cause: diagnosed.cause, code: diagnosed.code },
        checkedAt,
        durationMs: Date.now() - startedAt,
      },
    };
  }
}
