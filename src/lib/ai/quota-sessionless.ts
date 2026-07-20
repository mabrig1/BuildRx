/**
 * Plan-limit enforcement for AI-cost requests that have no Supabase
 * session — the API-key-authenticated /api/v1/* routes, and the
 * inbound workflow webhook trigger (both run against the service-role
 * client since there's no cookie to derive a session from).
 *
 * lib/billing/limits.ts's checkAiRequestLimit/checkProjectLimit call
 * createClient() (the cookie-scoped server client) and rely on RLS to
 * implicitly filter "the current user's" rows. Without a session that
 * client has no auth.uid() — RLS would silently return zero rows
 * regardless of an explicit .eq(user_id, …) filter, making the check
 * never trigger (a quota bypass, not just a wrong number). This uses
 * the service-role client instead, with an explicit owner filter doing
 * the scoping RLS would otherwise do.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

import { planById } from "@/lib/constants";
import type { Database } from "@/types/database";

async function effectivePlanForUser(
  admin: SupabaseClient<Database>,
  userId: string
): Promise<"free" | "pro"> {
  const { data } = await admin
    .from("subscriptions")
    .select("plan, status")
    .eq("user_id", userId)
    .maybeSingle();
  if (data && ["active", "trialing"].includes(data.status)) {
    return data.plan as "free" | "pro";
  }
  return "free";
}

/** Returns an error message when the given user is at their monthly AI request limit. */
export async function checkAiRequestLimitSessionless(
  admin: SupabaseClient<Database>,
  userId: string
): Promise<string | null> {
  const plan = planById(await effectivePlanForUser(admin, userId));

  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);

  const { count } = await admin
    .from("usage_logs")
    .select("*", { count: "exact", head: true })
    .eq("user_id", userId)
    .in("action", ["ai_message", "ai_generation"])
    .gte("created_at", monthStart.toISOString());
  if ((count ?? 0) >= plan.limits.aiRequestsPerMonth) {
    return `You've used all ${plan.limits.aiRequestsPerMonth} AI requests on the ${plan.name} plan this month${plan.id === "free" ? " — upgrade to Pro for 2,000/month" : ""}.`;
  }
  return null;
}
