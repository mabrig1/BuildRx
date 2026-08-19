import { classifyThrown } from "@/lib/health/error-response";
import { logError, logInfo } from "@/lib/health/logger";
import { withRetry } from "@/lib/health/retry";
import type { Subsystem } from "@/lib/health/types";
import { isSupabaseConfigured } from "@/lib/supabase/config";

export interface FixRunOutcome {
  ok: boolean;
  message: string;
}

/** Re-runs the originating check to confirm a fix actually resolved the issue. */
async function reverify(subsystem: string, code: string): Promise<string> {
  if (subsystem === "database") {
    const { checkDatabase } = await import("@/lib/health/checks/database");
    const outcome = await checkDatabase();
    return outcome.fixes.some((fix) => fix.code === code)
      ? "Applied, but re-checking the database still shows this issue — investigate manually."
      : "Applied and verified: the database check no longer reports this issue.";
  }
  if (subsystem === "auth") {
    const { checkAuth } = await import("@/lib/health/checks/auth");
    const outcome = await checkAuth();
    return outcome.fixes.some((fix) => fix.code === code)
      ? "Applied, but re-checking auth still shows this issue — investigate manually."
      : "Applied and verified: the auth check no longer reports this issue.";
  }
  return "Applied successfully.";
}

/**
 * Auto-Fix Agent, gated: applies a proposal's stored SQL only after
 * an admin has explicitly approved it (never called automatically by
 * a health check). Runs the fix through admin_exec_sql (service-role
 * only, retried), then re-verifies before reporting success.
 */
export async function approveAndApplyFix(
  proposalId: string,
  adminUserId: string
): Promise<FixRunOutcome> {
  if (!isSupabaseConfigured()) {
    return { ok: false, message: "Supabase is not configured." };
  }

  const { createAdminClient } = await import("@/lib/supabase/admin");
  const supabase = createAdminClient();

  const { data: proposal, error: fetchError } = await supabase
    .from("system_fix_proposals")
    .select("*")
    .eq("id", proposalId)
    .single();
  if (fetchError || !proposal) {
    return { ok: false, message: "Fix proposal not found." };
  }
  if (proposal.status !== "pending") {
    return { ok: false, message: `This proposal is already ${proposal.status}.` };
  }
  if (!proposal.sql_fix) {
    return {
      ok: false,
      message: "This proposal has no automated fix — apply the referenced migration manually.",
    };
  }

  const now = new Date().toISOString();
  await supabase
    .from("system_fix_proposals")
    .update({ status: "approved", reviewed_by: adminUserId, reviewed_at: now })
    .eq("id", proposalId);

  try {
    await withRetry(
      () => supabase.rpc("admin_exec_sql", { sql: proposal.sql_fix as string }),
      { attempts: 2, baseDelayMs: 500 }
    ).then(({ error }) => {
      if (error) throw error;
    });

    const result = await reverify(proposal.subsystem, proposal.code);
    await supabase
      .from("system_fix_proposals")
      .update({ status: "applied", applied_at: new Date().toISOString(), result })
      .eq("id", proposalId);

    await logInfo("fix-runner", `Applied fix "${proposal.title}"`, {
      subsystem: proposal.subsystem as Subsystem,
      context: { proposalId, code: proposal.code },
    });

    return { ok: true, message: result };
  } catch (error) {
    const diagnosed = classifyThrown(error, proposal.subsystem as Subsystem);
    await supabase
      .from("system_fix_proposals")
      .update({ status: "failed", result: diagnosed.message })
      .eq("id", proposalId);

    await logError("fix-runner", `Failed to apply fix "${proposal.title}": ${diagnosed.message}`, {
      subsystem: proposal.subsystem as Subsystem,
      code: diagnosed.code,
      context: { proposalId, cause: diagnosed.cause },
    });

    return { ok: false, message: diagnosed.message };
  }
}

/** Rejects a pending proposal without applying anything. */
export async function rejectFix(proposalId: string, adminUserId: string): Promise<FixRunOutcome> {
  if (!isSupabaseConfigured()) {
    return { ok: false, message: "Supabase is not configured." };
  }
  const { createAdminClient } = await import("@/lib/supabase/admin");
  const supabase = createAdminClient();

  const { error, count } = await supabase
    .from("system_fix_proposals")
    .update(
      { status: "rejected", reviewed_by: adminUserId, reviewed_at: new Date().toISOString() },
      { count: "exact" }
    )
    .eq("id", proposalId)
    .eq("status", "pending")
    .select("id");

  if (error) return { ok: false, message: error.message };
  if (!count) return { ok: false, message: "Proposal not found or already reviewed." };
  return { ok: true, message: "Proposal rejected." };
}
