import { NextResponse } from "next/server";

import { requireAdmin } from "@/lib/health/admin-guard";
import { runHealthChecks } from "@/lib/health/registry";

export const maxDuration = 60;

/** GET /api/health — runs every subsystem check and returns the report. */
export async function GET() {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  const report = await runHealthChecks();
  return NextResponse.json(report);
}
