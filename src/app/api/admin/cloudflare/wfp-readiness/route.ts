import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/health/admin-guard";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { readWfpNamespaceReadiness } from "@/lib/deploy/cloudflare-wfp-readiness";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function reply(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

/** Private operator diagnostics; never deploy, upload, update, or provision. */
export async function GET() {
  if (process.env.BUILDRX_WFP_OPERATOR_READINESS_ENABLED !== "true")
    return reply({ error: "Workers for Platforms readiness is disabled." }, 404);
  if (!isSupabaseConfigured())
    return reply({ error: "Administrator authentication is required." }, 503);
  try {
    const auth = await requireAdmin();
    if (!auth.ok) return auth.response;
    const report = await readWfpNamespaceReadiness(process.env);
    return reply(report);
  } catch {
    return reply({ error: "Operator readiness could not be verified." }, 503);
  }
}
