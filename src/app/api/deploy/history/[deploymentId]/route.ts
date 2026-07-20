import { NextResponse } from "next/server";

import { getSession } from "@/lib/github/service";
import { createClient } from "@/lib/supabase/server";

type RouteParams = { params: Promise<{ deploymentId: string }> };

/** DELETE /api/deploy/history/[deploymentId] — remove one deployment history entry (owner only). Not available in demo mode. */
export async function DELETE(_request: Request, { params }: RouteParams) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (session.demo) {
    return NextResponse.json({ error: "Not available in demo mode" }, { status: 400 });
  }
  const { deploymentId } = await params;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("deployments")
    .delete()
    .eq("id", deploymentId)
    .select("id")
    .maybeSingle();
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json({ error: "Deployment not found" }, { status: 404 });
  }

  return NextResponse.json({ success: true });
}
