import { NextResponse } from "next/server";

import { getAdminAnalytics, toCsv } from "@/lib/analytics/admin-data";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";

/**
 * GET /api/admin/reports?type=users|usage|revenue — CSV report export.
 * Admin-gated (open in demo mode).
 */
export async function GET(request: Request) {
  if (isSupabaseConfigured()) {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { data: me } = await supabase
      .from("users")
      .select("role")
      .eq("id", user.id)
      .single();
    if (me?.role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  const { searchParams } = new URL(request.url);
  const type = searchParams.get("type") ?? "users";
  const data = await getAdminAnalytics();

  let csv: string;
  switch (type) {
    case "usage":
      csv = toCsv(
        data.aiRequestsByDay.map((row) => ({
          date: row.date,
          ai_requests: row.count,
        }))
      );
      break;
    case "revenue":
      csv = toCsv(
        data.revenueByPlan.map((row) => ({
          plan: row.plan,
          subscribers: row.subscribers,
          mrr_usd: row.mrr,
        }))
      );
      break;
    case "users":
    default:
      csv = toCsv(
        data.signupsByDay.map((row) => ({
          date: row.date,
          signups: row.count,
        }))
      );
      break;
  }

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="app-creator-${type}-report.csv"`,
    },
  });
}
