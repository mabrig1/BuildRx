import { NextResponse } from "next/server";

import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";

export type AdminGuardResult =
  | { ok: true; userId: string | null }
  | { ok: false; response: NextResponse };

/**
 * Shared admin gate for the health/self-healing API routes — same
 * rule as the /admin dashboard: open in demo mode (no Supabase) for
 * exploration, admin-role-only once Supabase is connected.
 */
export async function requireAdmin(): Promise<AdminGuardResult> {
  if (!isSupabaseConfigured()) {
    return { ok: true, userId: null };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }

  const { data: me } = await supabase.from("users").select("role").eq("id", user.id).single();
  if (me?.role !== "admin") {
    return {
      ok: false,
      response: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    };
  }

  return { ok: true, userId: user.id };
}
