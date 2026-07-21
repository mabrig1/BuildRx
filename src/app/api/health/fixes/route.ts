import { NextResponse } from "next/server";

import { requireAdmin } from "@/lib/health/admin-guard";
import { listFixProposals } from "@/lib/health/registry";

/** GET /api/health/fixes — lists all fix proposals, most recent first. */
export async function GET() {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  const proposals = await listFixProposals();
  return NextResponse.json({ proposals });
}
