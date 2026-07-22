import { planById } from "@/lib/constants";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";

/**
 * Plan usage limits, enforced server-side at the points where usage is
 * created (project creation/duplication and AI requests).
 */

async function effectivePlan(userId: string): Promise<"free" | "pro"> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("subscriptions")
    .select("plan, status")
    .eq("user_id", userId)
    .maybeSingle();
  if (data && ["active", "trialing"].includes(data.status)) {
    return data.plan as "free" | "pro";
  }
  return "free";
}

/** Returns an error message when the user is at their project limit. */
export async function checkProjectLimit(
  userId: string
): Promise<string | null> {
  if (!isSupabaseConfigured()) return null; // demo mode: unmetered

  const plan = planById(await effectivePlan(userId));
  if (!Number.isFinite(plan.limits.projects)) return null;

  // Count only projects the user owns — RLS alone is not enough here,
  // since users can also see public/team projects (and admins see all),
  // which must not count against their personal quota.
  const supabase = await createClient();
  const { count } = await supabase
    .from("projects")
    .select("*", { count: "exact", head: true })
    .eq("owner_id", userId);
  if ((count ?? 0) >= plan.limits.projects) {
    return `The ${plan.name} plan allows ${plan.limits.projects} projects — upgrade to Pro for unlimited projects.`;
  }
  return null;
}

/** Returns an error message when the user is at their AI request limit. */
export async function checkAiRequestLimit(
  userId: string
): Promise<string | null> {
  if (!isSupabaseConfigured()) return null;

  const plan = planById(await effectivePlan(userId));
  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);

  // Same owner-scoping as above: admins can see every user's usage rows,
  // so an unfiltered count would burn their quota on platform-wide usage.
  const supabase = await createClient();
  const { count } = await supabase
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
