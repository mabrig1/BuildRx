import { checkAiServices } from "@/lib/health/checks/ai-services";
import { checkApi } from "@/lib/health/checks/api";
import { checkAuth } from "@/lib/health/checks/auth";
import { checkBackgroundJobs } from "@/lib/health/checks/background-jobs";
import { checkDatabase } from "@/lib/health/checks/database";
import { checkDeployment } from "@/lib/health/checks/deployment";
import { checkStorage } from "@/lib/health/checks/storage";
import type {
  CheckResult,
  FixCandidate,
  FixProposal,
  HealthReport,
  HealthStatus,
  Subsystem,
} from "@/lib/health/types";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import type { Database, Json } from "@/types/database";

function overallStatus(checks: CheckResult[]): HealthStatus {
  if (checks.some((check) => check.status === "down")) return "down";
  if (checks.some((check) => check.status === "degraded")) return "degraded";
  return "healthy";
}

type FixProposalRow = Database["public"]["Tables"]["system_fix_proposals"]["Row"];

function toFixProposal(row: FixProposalRow): FixProposal {
  return {
    id: row.id,
    subsystem: row.subsystem as Subsystem,
    code: row.code,
    title: row.title,
    description: row.description,
    sqlFix: row.sql_fix,
    status: row.status,
    createdAt: row.created_at,
    reviewedBy: row.reviewed_by,
    reviewedAt: row.reviewed_at,
    appliedAt: row.applied_at,
    result: row.result,
  };
}

/**
 * Monitoring Agent: runs every subsystem check in parallel, persists
 * a snapshot for the dashboard's history, and files (deduped) fix
 * proposals for anything a check flagged — never applies them.
 */
export async function runHealthChecks(): Promise<HealthReport> {
  const [database, auth, api, ai, deployment, storage, jobs] = await Promise.all([
    checkDatabase(),
    checkAuth(),
    checkApi(),
    checkAiServices(),
    checkDeployment(),
    checkStorage(),
    checkBackgroundJobs(),
  ]);

  const checks: CheckResult[] = [
    database.result,
    auth.result,
    api.result,
    ai.result,
    deployment.result,
    storage.result,
    jobs.result,
  ];

  const report: HealthReport = {
    overallStatus: overallStatus(checks),
    checks,
    takenAt: new Date().toISOString(),
  };

  const fixCandidates: Array<{ subsystem: Subsystem; candidate: FixCandidate }> = [
    ...database.fixes.map((candidate) => ({ subsystem: "database" as Subsystem, candidate })),
    ...auth.fixes.map((candidate) => ({ subsystem: "auth" as Subsystem, candidate })),
  ];

  await Promise.all([persistSnapshot(report), syncFixProposals(fixCandidates)]);

  return report;
}

async function persistSnapshot(report: HealthReport): Promise<void> {
  if (!isSupabaseConfigured()) return;
  try {
    const { createAdminClient } = await import("@/lib/supabase/admin");
    const supabase = createAdminClient();
    await supabase.from("system_health_snapshots").insert({
      overall_status: report.overallStatus,
      checks: report.checks as unknown as Json,
      taken_at: report.takenAt,
    });
  } catch (error) {
    console.error("[health] failed to persist health snapshot", error);
  }
}

/** Inserts a proposal for each candidate unless an identical one is already pending. */
async function syncFixProposals(
  candidates: Array<{ subsystem: Subsystem; candidate: FixCandidate }>
): Promise<void> {
  if (!isSupabaseConfigured() || candidates.length === 0) return;
  try {
    const { createAdminClient } = await import("@/lib/supabase/admin");
    const supabase = createAdminClient();

    for (const { subsystem, candidate } of candidates) {
      const { data: existing } = await supabase
        .from("system_fix_proposals")
        .select("id")
        .eq("subsystem", subsystem)
        .eq("code", candidate.code)
        .eq("status", "pending")
        .maybeSingle();
      if (existing) continue;

      await supabase.from("system_fix_proposals").insert({
        subsystem,
        code: candidate.code,
        title: candidate.title,
        description: candidate.description,
        sql_fix: candidate.sqlFix,
      });
    }
  } catch (error) {
    console.error("[health] failed to sync fix proposals", error);
  }
}

/** All fix proposals for the dashboard, most recent first. */
export async function listFixProposals(): Promise<FixProposal[]> {
  if (!isSupabaseConfigured()) return [];
  const { createAdminClient } = await import("@/lib/supabase/admin");
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("system_fix_proposals")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) {
    console.error("[health] failed to list fix proposals", error);
    return [];
  }
  return (data ?? []).map(toFixProposal);
}
