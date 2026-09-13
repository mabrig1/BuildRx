import { NextResponse } from "next/server";

import { flutterwaveVerify, paystackVerify } from "@/lib/billing/providers";
import { COURSE_PRICE_NGN, COURSE_SLUG } from "@/lib/course/buildrx-tech-plus";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const provider = searchParams.get("provider");

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.redirect(origin + "/login?next=/course");
  }

  try {
    const payment =
      provider === "paystack"
        ? await paystackVerify(searchParams.get("reference") ?? "")
        : provider === "flutterwave"
          ? await flutterwaveVerify(searchParams.get("transaction_id") ?? "")
          : null;

    if (!payment) throw new Error("Unknown payment provider");
    const expectedReferencePrefix = "techplus_" + user.id + "_";
    if (!payment.reference.startsWith(expectedReferencePrefix)) {
      throw new Error("Payment reference does not belong to this account");
    }
    if (payment.currency.toUpperCase() !== "NGN") {
      throw new Error("Unexpected payment currency");
    }
    if (payment.amount < COURSE_PRICE_NGN) {
      throw new Error("Payment amount does not match the course price");
    }

    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error("Service-role key is required to activate course enrollment");
    }

    const { createAdminClient } = await import("@/lib/supabase/admin");
    const admin = createAdminClient();

    const { error } = await admin.from("course_enrollments").upsert(
      {
        user_id: user.id,
        course_slug: COURSE_SLUG,
        status: "active",
        provider,
        provider_ref: payment.reference,
        amount: payment.amount,
        currency: payment.currency,
        enrolled_at: payment.paidAt,
      },
      { onConflict: "user_id,course_slug" }
    );

    if (error) throw error;

    return NextResponse.redirect(origin + "/course?enrolled=1");
  } catch {
    return NextResponse.redirect(origin + "/course?payment_failed=1");
  }
}
