import { plans } from "@/lib/constants";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";

/** Aggregated analytics for the admin dashboard (server-only). */

export interface DayCount {
  date: string; // YYYY-MM-DD
  count: number;
}

export interface AdminAnalytics {
  totals: {
    users: number;
    activeUsers7d: number;
    projects: number;
    aiRequests30d: number;
    mrr: number;
  };
  signupsByDay: DayCount[]; // 30d
  aiRequestsByDay: DayCount[]; // 14d
  revenueByPlan: Array<{ plan: string; mrr: number; subscribers: number }>;
  loginHistory: Array<{
    user: string;
    method: string;
    at: string;
  }>;
  courseProgress: Array<{
    course: string;
    completion: number; // 0–100
    learners: number;
  }>;
  activity: Array<{
    user: string;
    action: string;
    at: string;
  }>;
  demo: boolean;
}

const PLAN_PRICES: Record<string, number> = Object.fromEntries(
  plans.map((plan) => [plan.id, plan.price])
);

function dayKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function lastNDays(n: number): string[] {
  const days: string[] = [];
  const now = new Date();
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    days.push(dayKey(d));
  }
  return days;
}

function bucketByDay(timestamps: string[], days: string[]): DayCount[] {
  const buckets = new Map<string, number>(days.map((d) => [d, 0]));
  for (const ts of timestamps) {
    const key = ts.slice(0, 10);
    if (buckets.has(key)) buckets.set(key, (buckets.get(key) ?? 0) + 1);
  }
  return days.map((date) => ({ date, count: buckets.get(date) ?? 0 }));
}

// ------------------------------------------------------------------
// Demo dataset (deterministic, so the dashboard is fully explorable)
// ------------------------------------------------------------------

function demoData(): AdminAnalytics {
  const days30 = lastNDays(30);
  const days14 = lastNDays(14);
  const wave = (i: number, base: number, amp: number) =>
    Math.max(0, Math.round(base + amp * Math.sin(i / 3.2) + (i % 5)));

  const signupsByDay = days30.map((date, i) => ({
    date,
    count: wave(i, 6, 4),
  }));
  const aiRequestsByDay = days14.map((date, i) => ({
    date,
    count: wave(i, 140, 60),
  }));

  return {
    totals: {
      users: 1284,
      activeUsers7d: 342,
      projects: 3120,
      aiRequests30d: aiRequestsByDay.reduce((s, d) => s + d.count, 0) * 2,
      mrr: 4870,
    },
    signupsByDay,
    aiRequestsByDay,
    revenueByPlan: [
      { plan: "Free", mrr: 0, subscribers: 1096 },
      { plan: "Pro", mrr: 3650, subscribers: 146 },
      { plan: "Team", mrr: 1220, subscribers: 21 },
    ],
    loginHistory: [
      { user: "ada@example.com", method: "password", at: new Date(Date.now() - 6e5).toISOString() },
      { user: "grace@example.com", method: "oauth", at: new Date(Date.now() - 32e5).toISOString() },
      { user: "linus@example.com", method: "password", at: new Date(Date.now() - 78e5).toISOString() },
      { user: "margaret@example.com", method: "oauth", at: new Date(Date.now() - 16e6).toISOString() },
      { user: "alan@example.com", method: "password", at: new Date(Date.now() - 3e7).toISOString() },
    ],
    courseProgress: [
      { course: "Getting started with App-Creator", completion: 78, learners: 412 },
      { course: "Prompting for better builds", completion: 54, learners: 268 },
      { course: "Deploying to production", completion: 31, learners: 149 },
    ],
    activity: [
      { user: "ada@example.com", action: "Created project \"Storefront\"", at: new Date(Date.now() - 4e5).toISOString() },
      { user: "grace@example.com", action: "Ran agent build (17 files)", at: new Date(Date.now() - 9e5).toISOString() },
      { user: "linus@example.com", action: "Deployed to Vercel", at: new Date(Date.now() - 21e5).toISOString() },
      { user: "margaret@example.com", action: "Exported project to GitHub", at: new Date(Date.now() - 55e5).toISOString() },
      { user: "alan@example.com", action: "Sent 12 AI chat messages", at: new Date(Date.now() - 8e6).toISOString() },
    ],
    demo: true,
  };
}

// ------------------------------------------------------------------
// Live queries (admin RLS policies grant read access)
// ------------------------------------------------------------------

export async function getAdminAnalytics(): Promise<AdminAnalytics> {
  if (!isSupabaseConfigured()) {
    return demoData();
  }

  const supabase = await createClient();
  const since30 = new Date(Date.now() - 30 * 864e5).toISOString();
  const since14 = new Date(Date.now() - 14 * 864e5).toISOString();
  const since7 = new Date(Date.now() - 7 * 864e5).toISOString();

  const [
    usersCount,
    projectsCount,
    signups,
    aiUsage,
    activeUsers,
    subscriptions,
    logins,
    courseEvents,
    recentUsage,
    userRows,
  ] = await Promise.all([
    supabase.from("users").select("*", { count: "exact", head: true }),
    supabase.from("projects").select("*", { count: "exact", head: true }),
    supabase.from("users").select("created_at").gte("created_at", since30),
    supabase
      .from("usage_logs")
      .select("created_at, user_id, action")
      .in("action", ["ai_message", "ai_generation"])
      .gte("created_at", since30)
      .limit(5000),
    supabase
      .from("usage_logs")
      .select("user_id")
      .gte("created_at", since7)
      .limit(5000),
    supabase.from("subscriptions").select("plan, status"),
    supabase
      .from("analytics")
      .select("user_id, properties, created_at")
      .in("event_type", ["login", "signup"])
      .order("created_at", { ascending: false })
      .limit(15),
    supabase
      .from("analytics")
      .select("properties, created_at")
      .eq("event_type", "course_progress")
      .limit(2000),
    supabase
      .from("usage_logs")
      .select("user_id, action, created_at")
      .order("created_at", { ascending: false })
      .limit(15),
    supabase.from("users").select("id, email"),
  ]);

  const emailById = new Map(
    (userRows.data ?? []).map((u) => [u.id, u.email])
  );

  const revenueByPlan = plans.map((plan) => {
    const subs = (subscriptions.data ?? []).filter(
      (s) => s.plan === plan.id && ["active", "trialing"].includes(s.status)
    ).length;
    return {
      plan: plan.name,
      mrr: subs * (PLAN_PRICES[plan.id] ?? 0),
      subscribers: subs,
    };
  });

  // Course progress from analytics events: {course, percent}.
  const courseMap = new Map<string, { total: number; n: number }>();
  for (const row of courseEvents.data ?? []) {
    const props = row.properties as { course?: string; percent?: number };
    if (!props?.course) continue;
    const entry = courseMap.get(props.course) ?? { total: 0, n: 0 };
    entry.total += props.percent ?? 0;
    entry.n += 1;
    courseMap.set(props.course, entry);
  }

  return {
    totals: {
      users: usersCount.count ?? 0,
      activeUsers7d: new Set(
        (activeUsers.data ?? []).map((row) => row.user_id)
      ).size,
      projects: projectsCount.count ?? 0,
      aiRequests30d: (aiUsage.data ?? []).length,
      mrr: revenueByPlan.reduce((sum, p) => sum + p.mrr, 0),
    },
    signupsByDay: bucketByDay(
      (signups.data ?? []).map((row) => row.created_at),
      lastNDays(30)
    ),
    aiRequestsByDay: bucketByDay(
      (aiUsage.data ?? [])
        .filter((row) => row.created_at >= since14)
        .map((row) => row.created_at),
      lastNDays(14)
    ),
    revenueByPlan,
    loginHistory: (logins.data ?? []).map((row) => ({
      user: emailById.get(row.user_id ?? "") ?? "unknown",
      method:
        ((row.properties as { method?: string })?.method as string) ??
        "password",
      at: row.created_at,
    })),
    courseProgress: [...courseMap.entries()].map(([course, entry]) => ({
      course,
      completion: Math.round(entry.total / Math.max(1, entry.n)),
      learners: entry.n,
    })),
    activity: (recentUsage.data ?? []).map((row) => ({
      user: emailById.get(row.user_id) ?? "unknown",
      action: row.action.replace(/_/g, " "),
      at: row.created_at,
    })),
    demo: false,
  };
}

/** CSV report generation for the export endpoints. */
export function toCsv(rows: Array<Record<string, unknown>>): string {
  if (rows.length === 0) return "";
  const headers = Object.keys(rows[0]);
  const escape = (value: unknown) => {
    const s = String(value ?? "");
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [
    headers.join(","),
    ...rows.map((row) => headers.map((h) => escape(row[h])).join(",")),
  ].join("\n");
}
