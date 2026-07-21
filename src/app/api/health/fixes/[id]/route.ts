import { NextResponse } from "next/server";
import { z } from "zod";

import { approveAndApplyFix, rejectFix } from "@/lib/health/fix-runner";
import { requireAdmin } from "@/lib/health/admin-guard";

export const maxDuration = 60;

const actionSchema = z.object({ action: z.enum(["approve", "reject"]) });

/**
 * POST /api/health/fixes/:id — approve (apply now) or reject a fix
 * proposal. Approval is the only path that ever executes a proposal's
 * SQL; a health check never applies one on its own.
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  const { id } = await params;
  const body = await request.json().catch(() => null);
  const parsed = actionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request — expected { action: 'approve' | 'reject' }" }, { status: 400 });
  }

  const outcome =
    parsed.data.action === "approve"
      ? await approveAndApplyFix(id, auth.userId ?? "")
      : await rejectFix(id, auth.userId ?? "");

  return NextResponse.json(outcome, { status: outcome.ok ? 200 : 400 });
}
