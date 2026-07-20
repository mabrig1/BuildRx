import { NextResponse } from "next/server";

import { demoHistory } from "@/lib/deploy/service";
import { getSession } from "@/lib/github/service";
import { createClient } from "@/lib/supabase/server";

/** GET ?projectId= — deployment history with status and logs. */
export async function GET(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const projectId = searchParams.get("projectId");
  if (!projectId) {
    return NextResponse.json({ error: "projectId required" }, { status: 400 });
  }

  if (session.demo) {
    return NextResponse.json({
      deployments: demoHistory(projectId),
      hasMore: false,
      simulated: true,
    });
  }

  const offset = Math.max(0, Number(searchParams.get("offset") ?? 0) || 0);
  const limit = 20;

  const supabase = await createClient();
  const { data, error, count } = await supabase
    .from("deployments")
    .select("id, provider, status, url, domain, logs, error, created_at, completed_at", {
      count: "exact",
    })
    .eq("project_id", projectId)
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    deployments: (data ?? []).map((row) => ({
      id: row.id,
      provider: row.provider,
      status: row.status,
      url: row.url,
      domain: row.domain,
      logs: row.logs ?? "",
      error: row.error,
      createdAt: row.created_at,
      completedAt: row.completed_at,
    })),
    hasMore: offset + limit < (count ?? 0),
  });
}
