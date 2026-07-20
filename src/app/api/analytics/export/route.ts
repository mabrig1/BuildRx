import { NextResponse } from "next/server";

import { toCsv } from "@/lib/analytics/csv";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";

/**
 * GET /api/analytics/export — CSV of the caller's own usage_logs, last
 * 90 days (capped at 5,000 rows). Personal equivalent of the
 * admin-only /api/admin/reports export.
 */
export async function GET() {
  if (!isSupabaseConfigured()) {
    return NextResponse.json(
      { error: "Analytics export requires Supabase to be configured on this deployment." },
      { status: 503 }
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const since = new Date(Date.now() - 90 * 864e5).toISOString();
  const { data, error } = await supabase
    .from("usage_logs")
    .select("created_at, action, project_id, metadata")
    .eq("user_id", user.id)
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(5000);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const rows = (data ?? []).map((row) => {
    const meta = row.metadata as {
      model?: string;
      provider?: string;
      prompt_tokens?: number;
      completion_tokens?: number;
      status?: string;
    } | null;
    return {
      date: row.created_at,
      action: row.action,
      project_id: row.project_id ?? "",
      provider: meta?.provider ?? "",
      model: meta?.model ?? "",
      prompt_tokens: meta?.prompt_tokens ?? 0,
      completion_tokens: meta?.completion_tokens ?? 0,
      status: meta?.status ?? "",
    };
  });

  const csv = toCsv(rows);
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": `attachment; filename="usage-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
}
