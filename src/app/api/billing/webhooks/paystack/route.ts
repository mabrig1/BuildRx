import { NextResponse } from "next/server";

import { paystackVerifySignature } from "@/lib/billing/providers";
import { activateProSubscription } from "@/lib/billing/service";

/**
 * Paystack webhook: activates/renews the subscription on
 * charge.success. Signature: HMAC-SHA512 of the raw body in
 * x-paystack-signature.
 */
export async function POST(request: Request) {
  const rawBody = await request.text();
  const signature = request.headers.get("x-paystack-signature");
  if (!paystackVerifySignature(rawBody, signature)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  let event: {
    event?: string;
    data?: {
      reference?: string;
      amount?: number;
      currency?: string;
      paid_at?: string;
      metadata?: { user_id?: string };
    };
  };
  try {
    event = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  if (event.event === "charge.success" && event.data?.metadata?.user_id) {
    try {
      await activateProSubscription({
        userId: event.data.metadata.user_id,
        provider: "paystack",
        reference: event.data.reference ?? `ps_${Date.now()}`,
        amount: (event.data.amount ?? 0) / 100,
        currency: event.data.currency ?? "USD",
        paidAt: event.data.paid_at ?? new Date().toISOString(),
      });
    } catch (error) {
      console.error("Paystack webhook activation failed:", error);
      return NextResponse.json({ error: "Activation failed" }, { status: 500 });
    }
  }

  return NextResponse.json({ received: true });
}
