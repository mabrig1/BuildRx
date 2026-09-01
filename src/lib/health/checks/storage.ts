import { isCloudflareR2Configured } from "@/lib/cloudflare/config";
import { verifyR2Bucket } from "@/lib/cloudflare/r2";
import { classifyThrown } from "@/lib/health/error-response";
import { withRetry } from "@/lib/health/retry";
import type { CheckResult, HealthStatus } from "@/lib/health/types";
import { isSupabaseConfigured } from "@/lib/supabase/config";

/** Supabase stores live project data; Cloudflare R2 stores immutable ZIP artifacts. */
export async function checkStorage(): Promise<{ result: CheckResult }> {
  const startedAt = Date.now();
  const checkedAt = new Date().toISOString();
  const providers: Record<string, unknown> = {};
  const issues: string[] = [];

  if (isSupabaseConfigured()) {
    try {
      const { createAdminClient } = await import("@/lib/supabase/admin");
      const supabase = createAdminClient();
      const { data, error } = await withRetry(
        () => supabase.storage.listBuckets(),
        { attempts: 2 }
      );
      if (error) throw error;
      const buckets = data ?? [];
      providers.supabase = {
        configured: true,
        reachable: true,
        buckets: buckets.map((bucket) => ({
          name: bucket.name,
          public: bucket.public,
        })),
      };
    } catch (error) {
      const diagnosed = classifyThrown(error, "storage");
      providers.supabase = {
        configured: true,
        reachable: false,
        code: diagnosed.code,
      };
      issues.push("Supabase Storage is unreachable");
    }
  } else {
    providers.supabase = { configured: false, reachable: false };
    issues.push("Supabase Storage is not configured");
  }

  if (isCloudflareR2Configured()) {
    try {
      await verifyR2Bucket();
      providers.cloudflareR2 = { configured: true, reachable: true };
    } catch (error) {
      const diagnosed = classifyThrown(error, "storage");
      providers.cloudflareR2 = {
        configured: true,
        reachable: false,
        code: diagnosed.code,
      };
      issues.push("Cloudflare R2 is unreachable");
    }
  } else {
    providers.cloudflareR2 = { configured: false, reachable: false };
    issues.push("Cloudflare R2 artifact storage is not configured");
  }

  const supabase = providers.supabase as {
    configured: boolean;
    reachable: boolean;
  };
  const r2 = providers.cloudflareR2 as { reachable: boolean };
  const status: HealthStatus = supabase.configured && !supabase.reachable
    ? "down"
    : !supabase.reachable || !r2.reachable
      ? "degraded"
      : "healthy";

  return {
    result: {
      subsystem: "storage",
      label: "Storage",
      status,
      summary:
        issues.length === 0
          ? "Supabase Storage and Cloudflare R2 are reachable."
          : issues.join("; "),
      detail: { providers },
      checkedAt,
      durationMs: Date.now() - startedAt,
    },
  };
}
