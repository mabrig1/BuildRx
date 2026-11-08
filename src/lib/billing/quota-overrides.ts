import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";

/**
 * Per-user exemptions from BuildRx subscription quotas, independently
 * managed from billing and administration. Never grants provider capacity,
 * infrastructure resources, or exemption from safety/rate limits.
 *
 * This function only queries the current caller's RLS-protected record.
 * Errors and missing records fail closed to the normal plan quotas.
 */
export async function getAccountQuotaOverrides(userId: string): Promise<{
  unlimitedProjects: boolean;
  unlimitedAiRequests: boolean;
}> {
  const none = { unlimitedProjects: false, unlimitedAiRequests: false };
  if (!isSupabaseConfigured()) return none;

  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("account_quota_overrides")
      .select("unlimited_projects, unlimited_ai_requests")
      .eq("user_id", userId)
      .maybeSingle();

    if (error || !data) return none;
    return {
      unlimitedProjects: data.unlimited_projects === true,
      unlimitedAiRequests: data.unlimited_ai_requests === true,
    };
  } catch {
    return none;
  }
}
