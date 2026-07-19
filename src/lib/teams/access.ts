import { NextResponse } from "next/server";

import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";

/** Teams require Supabase — owner/membership-scoped, no demo-mode equivalent. */
export async function requireTeamUser() {
  if (!isSupabaseConfigured()) {
    return {
      ok: false as const,
      response: NextResponse.json(
        { error: "Teams require Supabase to be configured on this deployment." },
        { status: 503 }
      ),
    };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return {
      ok: false as const,
      response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }

  return { ok: true as const, supabase, userId: user.id, email: user.email ?? null };
}
