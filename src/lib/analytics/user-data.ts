/**
 * Personal usage analytics — the same underlying usage_logs data the
 * admin dashboard aggregates org-wide (admin-data.ts), scoped instead
 * to the signed-in user via their own RLS-scoped client. Lets a
 * regular user see their own AI usage, which previously only showed
 * up as two plain numbers on the billing page.
 */

import { bucketByDay, countBy, lastNDays, type DayCount } from "@/lib/analytics/time-buckets";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";

export interface UsageActivityRow {
  action: string;
  provider: string | null;
  model: string | null;
  projectId: string | null;
  createdAt: string;
}

export interface UserAnalytics {
  totals: {
    requests30d: number;
    projects: number;
    tokens30d: number;
  };
  requestsByDay: DayCount[];
  requestsByAction: { key: string; count: number }[];
  requestsByProvider: { key: string; count: number }[];
  recentActivity: UsageActivityRow[];
  demo: boolean;
}

function demoData(): UserAnalytics {
  const days = lastNDays(30);
  const wave = (i: number, base: number, amp: number) =>
    Math.max(0, Math.round(base + amp * Math.sin(i / 3.5) + (i % 3)));
  const requestsByDay = days.map((date, i) => ({ date, count: wave(i, 5, 4) }));
  const requests30d = requestsByDay.reduce((sum, d) => sum + d.count, 0);

  return {
    totals: { requests30d, projects: 4, tokens30d: requests30d * 620 },
    requestsByDay,
    requestsByAction: [
      { key: "ai_message", count: Math.round(requests30d * 0.6) },
      { key: "ai_generation", count: Math.round(requests30d * 0.3) },
      { key: "deployment", count: Math.round(requests30d * 0.1) },
    ],
    requestsByProvider: [
      { key: "nvidia", count: Math.round(requests30d * 0.7) },
      { key: "openai", count: Math.round(requests30d * 0.3) },
    ],
    recentActivity: [
      { action: "ai_message", provider: "nvidia", model: "z-ai/glm-5.2", projectId: null, createdAt: new Date(Date.now() - 6e5).toISOString() },
      { action: "ai_generation", provider: "nvidia", model: "z-ai/glm-5.2", projectId: null, createdAt: new Date(Date.now() - 3.2e6).toISOString() },
      { action: "deployment", provider: null, model: null, projectId: null, createdAt: new Date(Date.now() - 9e6).toISOString() },
    ],
    demo: true,
  };
}

export async function getUserAnalytics(userId: string): Promise<UserAnalytics> {
  if (!isSupabaseConfigured()) {
    return demoData();
  }

  const supabase = await createClient();
  const since30 = new Date(Date.now() - 30 * 864e5).toISOString();
  const days = lastNDays(30);

  const [usage, projectsCount, recent] = await Promise.all([
    supabase
      .from("usage_logs")
      .select("action, metadata, created_at")
      .eq("user_id", userId)
      .gte("created_at", since30)
      .limit(5000),
    supabase
      .from("projects")
      .select("*", { count: "exact", head: true })
      .eq("owner_id", userId),
    supabase
      .from("usage_logs")
      .select("action, project_id, metadata, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(20),
  ]);

  const rows = usage.data ?? [];
  const tokens30d = rows.reduce((sum, row) => {
    const meta = row.metadata as { prompt_tokens?: number; completion_tokens?: number } | null;
    return sum + (meta?.prompt_tokens ?? 0) + (meta?.completion_tokens ?? 0);
  }, 0);

  return {
    totals: {
      requests30d: rows.length,
      projects: projectsCount.count ?? 0,
      tokens30d,
    },
    requestsByDay: bucketByDay(
      rows.map((row) => row.created_at),
      days
    ),
    requestsByAction: countBy(rows, (row) => row.action),
    requestsByProvider: countBy(rows, (row) => {
      const meta = row.metadata as { provider?: string | null } | null;
      return meta?.provider ?? "unknown";
    }),
    recentActivity: (recent.data ?? []).map((row) => {
      const meta = row.metadata as { model?: string; provider?: string } | null;
      return {
        action: row.action,
        provider: meta?.provider ?? null,
        model: meta?.model ?? null,
        projectId: row.project_id,
        createdAt: row.created_at,
      };
    }),
    demo: false,
  };
}
