import type { Metadata } from "next";
import { redirect } from "next/navigation";
import {
  Activity,
  Bot,
  DollarSign,
  Download,
  FolderKanban,
  GraduationCap,
  KeyRound,
  Users,
} from "lucide-react";

import { AdminCharts } from "@/components/admin/admin-charts";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getAdminAnalytics } from "@/lib/analytics/admin-data";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";
import { timeAgo } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Admin",
};

export default async function AdminPage() {
  // Gate: admins only (demo mode is open for exploration).
  if (isSupabaseConfigured()) {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) redirect("/login?next=/admin");
    const { data: me } = await supabase
      .from("users")
      .select("role")
      .eq("id", user.id)
      .single();
    if (me?.role !== "admin") redirect("/dashboard");
  }

  const data = await getAdminAnalytics();

  const stats = [
    { label: "Total users", value: data.totals.users.toLocaleString(), icon: Users },
    { label: "Active users (7d)", value: data.totals.activeUsers7d.toLocaleString(), icon: Activity },
    { label: "Projects created", value: data.totals.projects.toLocaleString(), icon: FolderKanban },
    { label: "AI requests (30d)", value: data.totals.aiRequests30d.toLocaleString(), icon: Bot },
    { label: "MRR", value: `$${data.totals.mrr.toLocaleString()}`, icon: DollarSign },
  ];

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
      <PageHeader
        title="Admin analytics"
        description="Platform health, usage, and revenue."
      >
        {data.demo ? <Badge variant="outline">demo data</Badge> : null}
        {(["users", "usage", "revenue"] as const).map((report) => (
          <Button key={report} variant="outline" size="sm" asChild>
            <a href={`/api/admin/reports?type=${report}`} download>
              <Download />
              <span className="capitalize">{report}.csv</span>
            </a>
          </Button>
        ))}
      </PageHeader>

      {/* Stat tiles */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-5">
        {stats.map((stat) => (
          <Card key={stat.label} className="gap-1 py-5">
            <CardHeader className="gap-1">
              <CardDescription className="flex items-center gap-1.5 text-xs">
                <stat.icon className="size-3.5 shrink-0" />
                {stat.label}
              </CardDescription>
              <CardTitle className="text-2xl tabular-nums">
                {stat.value}
              </CardTitle>
            </CardHeader>
          </Card>
        ))}
      </div>

      {/* Charts */}
      <AdminCharts data={data} />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Login history */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <KeyRound className="size-4" />
              Login history
            </CardTitle>
            <CardDescription>Most recent sign-ins.</CardDescription>
          </CardHeader>
          <CardContent>
            {data.loginHistory.length === 0 ? (
              <p className="text-muted-foreground text-sm">No logins yet.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>User</TableHead>
                    <TableHead>Method</TableHead>
                    <TableHead className="text-right">When</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.loginHistory.map((login, index) => (
                    <TableRow key={index}>
                      <TableCell className="max-w-44 truncate">
                        {login.user}
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="capitalize">
                          {login.method}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground text-right text-xs">
                        {timeAgo(login.at)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Course progress */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <GraduationCap className="size-4" />
              Course progress
            </CardTitle>
            <CardDescription>
              Average completion across learners.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4">
            {data.courseProgress.length === 0 ? (
              <p className="text-muted-foreground text-sm">
                No course activity tracked yet.
              </p>
            ) : (
              data.courseProgress.map((course) => (
                <div key={course.course} className="grid gap-1.5">
                  <div className="flex items-baseline justify-between gap-2">
                    <p className="truncate text-sm">{course.course}</p>
                    <p className="text-muted-foreground shrink-0 text-xs tabular-nums">
                      {course.completion}% · {course.learners} learners
                    </p>
                  </div>
                  <Progress value={course.completion} />
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      {/* User activity */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="size-4" />
            User activity
          </CardTitle>
          <CardDescription>Latest actions across the platform.</CardDescription>
        </CardHeader>
        <CardContent>
          {data.activity.length === 0 ? (
            <p className="text-muted-foreground text-sm">No activity yet.</p>
          ) : (
            <ul className="grid grid-cols-1 gap-2">
              {data.activity.map((entry, index) => (
                <li
                  key={index}
                  className="flex items-center justify-between gap-3 border-b pb-2 text-sm last:border-0 last:pb-0"
                >
                  <span className="min-w-0 truncate">
                    <span className="text-muted-foreground">{entry.user}</span>{" "}
                    — {entry.action}
                  </span>
                  <span className="text-muted-foreground shrink-0 text-xs">
                    {timeAgo(entry.at)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
