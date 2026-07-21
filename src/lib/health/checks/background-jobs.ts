import type { CheckResult } from "@/lib/health/types";

/**
 * Monitoring Agent — background jobs. This deployment has no
 * queue/cron worker: rate limiting runs in-process (src/lib/rate-limit.ts)
 * and everything else (AI generation, deploys) runs inline within the
 * request that triggered it. Reported honestly rather than faking a
 * job-queue status that doesn't exist.
 */
export async function checkBackgroundJobs(): Promise<{ result: CheckResult }> {
  const startedAt = Date.now();
  const checkedAt = new Date().toISOString();

  return {
    result: {
      subsystem: "jobs",
      label: "Background jobs",
      status: "healthy",
      summary:
        "No queue/cron worker is configured — all work (AI generation, deploys) runs inline in the request; rate limiting is in-process only.",
      detail: { queueConfigured: false, inProcessRateLimiter: true },
      checkedAt,
      durationMs: Date.now() - startedAt,
    },
  };
}
