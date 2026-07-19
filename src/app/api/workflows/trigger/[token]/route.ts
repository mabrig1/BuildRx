import { NextResponse } from "next/server";

import { rateLimit, rateLimitHeaders } from "@/lib/rate-limit";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createAdminClient } from "@/lib/supabase/admin";
import { runWorkflow } from "@/lib/workflows/engine";
import type { Json } from "@/types/database";

export const maxDuration = 180;

type RouteParams = { params: Promise<{ token: string }> };

/**
 * POST /api/workflows/trigger/[token] — inbound webhook trigger, no
 * auth required (the token itself is the credential — mint a new one
 * by recreating the workflow's trigger if it leaks). Only works for
 * workflows with trigger_type "webhook" and enabled=true. Unauthenticated,
 * so this uses the service-role client rather than RLS.
 */
export async function POST(request: Request, { params }: RouteParams) {
  if (!isSupabaseConfigured() || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json(
      { error: "Workflow webhook triggers require Supabase to be configured on this deployment." },
      { status: 503 }
    );
  }
  const { token } = await params;

  const limit = rateLimit(`workflow-trigger:${token}`, { limit: 30, windowMs: 60_000 });
  if (!limit.success) {
    return NextResponse.json(
      { error: "Too many requests — please slow down." },
      { status: 429, headers: rateLimitHeaders(limit) }
    );
  }

  const admin = createAdminClient();

  const workflow = await admin
    .from("workflows")
    .select("id, owner_id, enabled, trigger_type")
    .eq("webhook_token", token)
    .maybeSingle();
  if (!workflow.data) {
    return NextResponse.json({ error: "Unknown trigger" }, { status: 404 });
  }
  if (workflow.data.trigger_type !== "webhook") {
    return NextResponse.json({ error: "This workflow isn't set up for webhook triggers." }, { status: 400 });
  }
  if (!workflow.data.enabled) {
    return NextResponse.json({ error: "This workflow is disabled." }, { status: 403 });
  }

  const { data: steps, error: stepsError } = await admin
    .from("workflow_steps")
    .select("*")
    .eq("workflow_id", workflow.data.id)
    .order("position", { ascending: true });
  if (stepsError) {
    return NextResponse.json({ error: stepsError.message }, { status: 500 });
  }
  if (!steps || steps.length === 0) {
    return NextResponse.json({ error: "This workflow has no steps yet." }, { status: 400 });
  }

  const payload: Json = await request.json().catch(() => null);

  const outcome = await runWorkflow({
    supabase: admin,
    ownerId: workflow.data.owner_id,
    workflowId: workflow.data.id,
    steps,
    trigger: "webhook",
    triggerInput: payload,
  });

  return NextResponse.json(outcome, { status: outcome.status === "failed" ? 502 : 200 });
}
