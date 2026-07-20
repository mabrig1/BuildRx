import { NextResponse } from "next/server";

import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";

/** Publishing/managing templates requires Supabase — browsing curated templates works without it (demo mode has none to show). */
export async function requireTemplateUser() {
  if (!isSupabaseConfigured()) {
    return {
      ok: false as const,
      response: NextResponse.json(
        { error: "The marketplace requires Supabase to be configured on this deployment." },
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
