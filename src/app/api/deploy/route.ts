import { NextResponse } from "next/server";

import { demoDeployState } from "@/lib/deploy/service";
import { getSession } from "@/lib/github/service";
import { createClient } from "@/lib/supabase/server";

/**
 * GET /api/deploy — deployment API index: supported providers, the
 * caller's connection status, and the operation endpoints.
 */
export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let connections: Record<string, boolean>;
  if (session.demo) {
    const tokens = demoDeployState().tokens;
    connections = {
      vercel: tokens.has("vercel"),
      netlify: tokens.has("netlify"),
      railway: tokens.has("railway"),
    };
  } else {
    const supabase = await createClient();
    const { data } = await supabase
      .from("integration_connections")
      .select("provider")
      .in("provider", ["vercel", "netlify", "railway"]);
    const connected = new Set((data ?? []).map((row) => row.provider));
    connections = {
      vercel: connected.has("vercel"),
      netlify: connected.has("netlify"),
      railway: connected.has("railway"),
    };
  }

  return NextResponse.json({
    providers: ["vercel", "netlify", "railway"],
    connections,
    ...(session.demo ? { simulated: true } : {}),
    endpoints: {
      run: "POST /api/deploy/run { projectId, provider }",
      history: "GET /api/deploy/history?projectId=",
      connection:
        "GET|POST|DELETE /api/deploy/connection — manage provider tokens",
      domain: "POST /api/deploy/domain { projectId, provider, domain }",
    },
  });
}
