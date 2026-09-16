import { NextResponse } from "next/server";

import {
  flutterwaveVerify,
  paystackVerify,
} from "@/lib/billing/providers";
import { activateProSubscription } from "@/lib/billing/service";
import { reportMabrigConversion } from "@/lib/mabrig-growth";
import { createClient } from "@/lib/supabase/server";

/**
 * GET — checkout callback. Verifies the transaction with the provider
 * server-side, activates the subscription, then redirects to /billing.
 *
 * Paystack calls back with ?reference=; Flutterwave with
 * ?status=&tx_ref=&transaction_id=.
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const provider = searchParams.get("provider");

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.redirect(`${origin}/login?next=/billing`);
  }

  try {
    if (provider === "paystack") {
      const reference = searchParams.get("reference");
      if (!reference) throw new Error("Missing reference");
      const payment = await paystackVerify(reference);
      await activateProSubscription({
        userId: user.id,
        provider: "paystack",
        reference: payment.reference,
        amount: payment.amount,
        currency: payment.currency,
        paidAt: payment.paidAt,
      });
      await reportMabrigConversion({
        id: `buildrx:paystack:${payment.reference}`,
        type: "purchase",
        email: payment.customerEmail || user.email || "",
        amount: payment.amount,
        currency: payment.currency,
        attributionToken:
          typeof payment.metadata.mabrig_attribution === "string"
            ? payment.metadata.mabrig_attribution
            : undefined,
        product: "BuildRx Pro",
        reference: payment.reference,
        occurredAt: payment.paidAt,
        source: "buildrx:paystack",
      });
    } else if (provider === "flutterwave") {
      const transactionId = searchParams.get("transaction_id");
      if (!transactionId) throw new Error("Payment was not completed");
      const payment = await flutterwaveVerify(transactionId);
      await activateProSubscription({
        userId: user.id,
        provider: "flutterwave",
        reference: payment.reference,
        amount: payment.amount,
        currency: payment.currency,
        paidAt: payment.paidAt,
      });
      await reportMabrigConversion({
        id: `buildrx:flutterwave:${payment.reference}`,
        type: "purchase",
        email: payment.customerEmail || user.email || "",
        amount: payment.amount,
        currency: payment.currency,
        attributionToken:
          typeof payment.metadata.mabrig_attribution === "string"
            ? payment.metadata.mabrig_attribution
            : undefined,
        product: "BuildRx Pro",
        reference: payment.reference,
        occurredAt: payment.paidAt,
        source: "buildrx:flutterwave",
      });
    } else {
      throw new Error("Unknown provider");
    }
    return NextResponse.redirect(`${origin}/billing?upgraded=1`);
  } catch {
    return NextResponse.redirect(`${origin}/billing?payment_failed=1`);
  }
}
