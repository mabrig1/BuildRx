import { classifyThrown } from "@/lib/health/error-response";
import { withRetry } from "@/lib/health/retry";
import { CORE_TABLES, SCHEMA_CATALOG } from "@/lib/health/schema-catalog";
import type { CheckResult, FixCandidate, HealthStatus } from "@/lib/health/types";
import { isSupabaseConfigured } from "@/lib/supabase/config";

export interface DatabaseCheckOutcome {
  result: CheckResult;
  fixes: FixCandidate[];
}

/**
 * Database Agent: verifies every table the schema expects actually
 * exists and has row-level security enabled, using the read-only
 * `health_table_status` RPC (see migration 20260721050000). Missing
 * or unprotected tables become fix proposals — never applied here.
 */
export async function checkDatabase(): Promise<DatabaseCheckOutcome> {
  const startedAt = Date.now();
  const checkedAt = new Date().toISOString();

  if (!isSupabaseConfigured()) {
    return {
      result: {
        subsystem: "database",
        label: "Database",
        status: "degraded",
        summary: "Running in demo mode — Supabase is not configured.",
        checkedAt,
        durationMs: Date.now() - startedAt,
      },
      fixes: [],
    };
  }

  try {
    const { createAdminClient } = await import("@/lib/supabase/admin");
    const supabase = createAdminClient();
    const tableNames = SCHEMA_CATALOG.map((t) => t.table);

    const { data, error } = await withRetry(
      () => supabase.rpc("health_table_status", { table_names: tableNames }),
      { attempts: 3, baseDelayMs: 300 }
    );
    if (error) throw error;

    const rows = data ?? [];
    const missing = rows.filter((r) => !r.table_exists);
    const noRls = rows.filter((r) => r.table_exists && r.table_exists && !r.rls_enabled);

    const fixes: FixCandidate[] = [];

    for (const row of missing) {
      const info = SCHEMA_CATALOG.find((t) => t.table === row.table_name);
      fixes.push({
        code: `DB_TABLE_MISSING_${row.table_name.toUpperCase()}`,
        title: `Create missing table "${row.table_name}"`,
        description: info?.recoverySql
          ? `The "${row.table_name}" table is missing from the database — every query against it is failing. Approving this proposal creates it (with its row-level-security policies) matching the current schema.`
          : `The "${row.table_name}" table is missing. This table doesn't have a one-click recovery script yet — re-apply supabase/migrations/${info?.migration ?? "the relevant migration"} manually (Supabase SQL editor or \`supabase db push\`).`,
        sqlFix: info?.recoverySql ?? null,
      });
    }

    for (const row of noRls) {
      fixes.push({
        code: `DB_RLS_DISABLED_${row.table_name.toUpperCase()}`,
        title: `Enable row-level security on "${row.table_name}"`,
        description: `"${row.table_name}" exists but row-level security is OFF — its existing policies aren't being enforced, so access control on this table is not active.`,
        sqlFix: `alter table public.${row.table_name} enable row level security;`,
      });
    }

    let status: HealthStatus = "healthy";
    if (missing.length > 0) status = "down";
    else if (noRls.length > 0) status = "degraded";

    const summary =
      missing.length > 0
        ? `${missing.length} table(s) missing: ${missing.map((r) => r.table_name).join(", ")}`
        : noRls.length > 0
          ? `${noRls.length} table(s) have RLS disabled: ${noRls.map((r) => r.table_name).join(", ")}`
          : `All ${rows.length} expected tables present with RLS enabled.`;

    return {
      result: {
        subsystem: "database",
        label: "Database",
        status,
        summary,
        detail: {
          totalChecked: rows.length,
          missing: missing.map((r) => r.table_name),
          rlsDisabled: noRls.map((r) => r.table_name),
          coreTablesTracked: [...CORE_TABLES],
        },
        checkedAt,
        durationMs: Date.now() - startedAt,
      },
      fixes,
    };
  } catch (error) {
    const diagnosed = classifyThrown(error, "database");
    return {
      result: {
        subsystem: "database",
        label: "Database",
        status: "down",
        summary: diagnosed.message,
        detail: { cause: diagnosed.cause, code: diagnosed.code },
        checkedAt,
        durationMs: Date.now() - startedAt,
      },
      fixes: [],
    };
  }
}
