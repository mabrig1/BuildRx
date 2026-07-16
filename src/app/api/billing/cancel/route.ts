import { NextResponse } from "next/server";

import { demoBilling } from "@/lib/billing/service";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";

/**
 * POST — cancel at period end (access continues until the period
 * expires). Provider-side recurring plans should also be disabled in
 * the provider dashboard or via their subscription APIs.
 */
export async function POST() {
  if (!isSupabaseConfigured()) {
    const state = demoBilling();
    if (state.plan !== "pro") {
      return NextResponse.json({ error: "No active subscription" }, { status: 400 });
    }
    state.cancelAtPeriodEnd = true;
    return NextResponse.json({ canceled: true, simulated: true });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json(
      { error: "Billing management requires the service-role key." },
      { status: 503 }
    );
  }

  const { createAdminClient } = await import("@/lib/supabase/admin");
  const admin = createAdminClient();
  const { error } = await admin
    .from("subscriptions")
    .update({ cancel_at_period_end: true })
    .eq("user_id", user.id)
    .eq("status", "active");
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ canceled: true });
}
