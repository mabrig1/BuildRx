import { NextResponse } from "next/server";

import { flutterwaveVerifySignature } from "@/lib/billing/providers";
import { activateProSubscription } from "@/lib/billing/service";
import { fulfillCourseWebhook, isCourseCheckout } from "@/lib/course/entitlements";
import { reportMabrigConversion } from "@/lib/mabrig-growth";

/**
 * Flutterwave webhook: activates/renews the subscription on
 * charge.completed. Authenticated via the verif-hash header matching
 * FLUTTERWAVE_SECRET_HASH.
 */
export async function POST(request: Request) {
  const signature = request.headers.get("verif-hash");
  if (!flutterwaveVerifySignature(signature)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  const event = (await request.json().catch(() => null)) as {
    event?: string;
    data?: {
      tx_ref?: string;
      id?: string | number;
      amount?: number;
      currency?: string;
      created_at?: string;
      status?: string;
      meta?: { user_id?: string; product?: string; purchase_type?: string; mabrig_attribution?: string };
      customer?: { email?: string };
    };
  } | null;
  if (!event) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  if (event.event === "charge.completed" &&
      event.data?.status === "successful" &&
      isCourseCheckout(event.data?.meta, event.data?.tx_ref)) {
    try {
      if (!event.data?.tx_ref || event.data.id === undefined) {
        throw new Error("Missing provider transaction fields");
      }
      await fulfillCourseWebhook({
        provider: "flutterwave",
        reference: event.data.tx_ref,
        transactionId: String(event.data.id),
      });
      return NextResponse.json({ received: true });
    } catch {
      // Authentication and direct provider verification must both succeed.
      return NextResponse.json({ error: "Course activation pending" }, { status: 500 });
    }
  }

  if (
    event.event === "charge.completed" &&
    event.data?.status === "successful" &&
    event.data?.meta?.user_id
  ) {
    try {
      const reference = event.data.tx_ref ?? `flw_${Date.now()}`;
      const amount = event.data.amount ?? 0;
      const currency = event.data.currency ?? "USD";
      const paidAt = event.data.created_at ?? new Date().toISOString();

      await activateProSubscription({
        userId: event.data.meta.user_id,
        provider: "flutterwave",
        reference,
        amount,
        currency,
        paidAt,
      });

      if (event.data.customer?.email) {
        await reportMabrigConversion({
          id: `buildrx:flutterwave:${reference}`,
          type: "purchase",
          email: event.data.customer.email,
          amount,
          currency,
          attributionToken: event.data.meta.mabrig_attribution,
          product: "BuildRx Pro",
          reference,
          occurredAt: paidAt,
          source: "buildrx:flutterwave",
        });
      }
    } catch (error) {
      console.error("Flutterwave webhook activation failed:", error);
      return NextResponse.json({ error: "Activation failed" }, { status: 500 });
    }
  }

  return NextResponse.json({ received: true });
}
