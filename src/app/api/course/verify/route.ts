import { NextResponse } from "next/server";

import { flutterwaveVerify, paystackVerify } from "@/lib/billing/providers";
import { activateVerifiedCoursePayment } from "@/lib/course/entitlements";
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
    // The provider's verified response, not the URL parameters, identifies
    // the purchaser and the product. Never grant access based on query data.
    const returnedReference =
      searchParams.get("reference") ?? searchParams.get("tx_ref");
    if (returnedReference && returnedReference !== payment.reference) {
      throw new Error("Checkout reference does not match verified payment");
    }
    await activateVerifiedCoursePayment({
      payment,
      provider,
      signedInUserId: user.id,
    });

    return NextResponse.redirect(origin + "/course?enrolled=1");
  } catch {
    return NextResponse.redirect(origin + "/course?payment_failed=1");
  }
}
