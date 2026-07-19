import { NextResponse } from "next/server";

import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";

/** Content Studio requires Supabase — no demo-mode equivalent for owner-scoped content/prompts. */
export async function requireContentUser() {
  if (!isSupabaseConfigured()) {
    return {
      ok: false as const,
      response: NextResponse.json(
        { error: "Content Studio requires Supabase to be configured on this deployment." },
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

  return { ok: true as const, supabase, userId: user.id };
}
