import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Download, MessageSquare, Sparkles, Zap } from "lucide-react";

import { UserAnalyticsCharts } from "@/components/analytics/user-analytics-charts";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getUserAnalytics } from "@/lib/analytics/user-data";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";
import { formatDate } from "@/lib/utils";

export const metadata: Metadata = { title: "Analytics" };
export const dynamic = "force-dynamic";

function StatCard({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: string;
  icon: React.ComponentType<{ className?: string }>;
}) {
  return (
    <Card>
      <CardContent className="flex items-center gap-3 py-4">
        <span className="bg-muted flex size-10 shrink-0 items-center justify-center rounded-lg">
          <Icon className="text-muted-foreground size-5" />
        </span>
        <div>
          <p className="text-muted-foreground text-xs">{label}</p>
          <p className="text-xl font-semibold tabular-nums">{value}</p>
        </div>
      </CardContent>
    </Card>
  );
}

export default async function AnalyticsPage() {
  let userId: string | null = null;
  if (isSupabaseConfigured()) {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) redirect("/login?next=/analytics");
    userId = user.id;
  }

  // getUserAnalytics returns a demo dataset whenever Supabase isn't
  // configured, ignoring the id — the "" placeholder is never used.
  const data = await getUserAnalytics(userId ?? "");

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
      <PageHeader title="Analytics" description="Your AI usage across the last 30 days.">
        <Button variant="outline" asChild>
          <a href="/api/analytics/export">
            <Download />
            Export CSV
          </a>
        </Button>
      </PageHeader>

      {data.demo ? (
        <p className="text-muted-foreground rounded-lg border border-dashed px-4 py-2 text-sm">
          Showing demo data — connect Supabase to see your real usage.
        </p>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Requests (30d)" value={data.totals.requests30d.toLocaleString()} icon={Zap} />
        <StatCard label="Tokens (30d)" value={data.totals.tokens30d.toLocaleString()} icon={Sparkles} />
        <StatCard label="Projects" value={data.totals.projects.toLocaleString()} icon={MessageSquare} />
      </div>

      <UserAnalyticsCharts data={data} />

      <div className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Recent activity</h2>
        {data.recentActivity.length === 0 ? (
          <p className="text-muted-foreground text-sm">No activity yet.</p>
        ) : (
          <div className="overflow-x-auto rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Action</TableHead>
                  <TableHead>Provider</TableHead>
                  <TableHead>Model</TableHead>
                  <TableHead className="text-right">When</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.recentActivity.map((row, i) => (
                  <TableRow key={i}>
                    <TableCell className="capitalize">{row.action.replace(/_/g, " ")}</TableCell>
                    <TableCell className="text-muted-foreground">{row.provider ?? "—"}</TableCell>
                    <TableCell className="text-muted-foreground truncate max-w-48">
                      {row.model ?? "—"}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-right">
                      {formatDate(row.createdAt)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </div>
  );
}
