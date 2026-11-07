import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/health/admin-guard";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { checkCloudflareOperatorReadiness } from "@/lib/deploy/cloudflare-operator-readiness";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function reply(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status, headers: { "Cache-Control": "no-store" },
  });
}

/**
 * GET /api/admin/cloudflare/managed-readiness
 * Operator-only and deliberately disabled by default. No writes, no launches.
 * Never show cloud credentials even when the API returns provider errors.
 */
export async function GET() {
  if (process.env.BUILDRX_MANAGED_OPERATOR_PREFLIGHT_ENABLED !== "true") {
    return reply({ error: "Operator readiness check is disabled." }, 404);
  }
  // The existing shared admin guard allows demo access for local health
  // exploration; real provider credentials must NEVER be checked in demo.
  if (!isSupabaseConfigured()) {
    return reply({ error: "Administrator authentication is required." }, 503);
  }
  try {
    const auth = await requireAdmin();
    if (!auth.ok) return auth.response;
    const readiness = await checkCloudflareOperatorReadiness(process.env);
    return reply(readiness);
  } catch {
    return reply({ error: "Cloudflare operator checks could not be completed." }, 503);
  }
}
