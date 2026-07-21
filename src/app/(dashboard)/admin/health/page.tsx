import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { HeartPulse } from "lucide-react";

import { ErrorHistoryTable } from "@/components/admin/error-history-table";
import { FixProposalsPanel } from "@/components/admin/fix-proposals-panel";
import { HealthStatusGrid } from "@/components/admin/health-status-grid";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { getRecentLogs } from "@/lib/health/logger";
import { listFixProposals, runHealthChecks } from "@/lib/health/registry";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Health",
};

const OVERALL_LABEL = {
  healthy: "All systems healthy",
  degraded: "Degraded — some systems need attention",
  down: "Down — at least one system is failing",
} as const;

const OVERALL_CLASS = {
  healthy: "border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  degraded: "border-amber-500/40 bg-amber-500/10 text-amber-600 dark:text-amber-400",
  down: "border-destructive/40 bg-destructive/10 text-destructive",
} as const;

export default async function HealthPage() {
  // Gate: admins only (demo mode is open for exploration), same rule
  // as /admin.
  if (isSupabaseConfigured()) {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) redirect("/login?next=/admin/health");
    const { data: me } = await supabase.from("users").select("role").eq("id", user.id).single();
    if (me?.role !== "admin") redirect("/dashboard");
  }

  const [report, proposals, logs] = await Promise.all([
    runHealthChecks(),
    listFixProposals(),
    getRecentLogs(30),
  ]);

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
      <PageHeader
        title="Platform health"
        description="Live status for every subsystem — diagnosed automatically, fixed with your approval."
      >
        <Badge
          variant="outline"
          className={cn("gap-1.5", OVERALL_CLASS[report.overallStatus])}
        >
          <HeartPulse className="size-3.5" />
          {OVERALL_LABEL[report.overallStatus]}
        </Badge>
      </PageHeader>

      <HealthStatusGrid checks={report.checks} />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <FixProposalsPanel proposals={proposals} />
        <ErrorHistoryTable logs={logs} />
      </div>
    </div>
  );
}
