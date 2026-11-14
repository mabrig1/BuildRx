import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";

/**
 * Fail-closed server-side admin check for every Client Management page and API.
 * Never trust a supplied email address, JWT user metadata or query parameter.
 */
export async function getClientAdminSession() {
  if (!isSupabaseConfigured()) return null;
  const db = await createClient();
  const { data: { user }, error } = await db.auth.getUser();
  if (error || !user) return null;
  const { data: account, error: roleError } = await db.from("users")
    .select("role").eq("id", user.id).maybeSingle();
  if (roleError || account?.role !== "admin") return null;
  return { db, user };
}
