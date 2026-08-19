import { NextResponse } from "next/server";

import { flutterwaveVerifySignature } from "@/lib/billing/providers";
import { activateProSubscription } from "@/lib/billing/service";

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
      amount?: number;
      currency?: string;
      created_at?: string;
      status?: string;
      meta?: { user_id?: string };
    };
  } | null;
  if (!event) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  if (
    event.event === "charge.completed" &&
    event.data?.status === "successful" &&
    event.data?.meta?.user_id
  ) {
    try {
      await activateProSubscription({
        userId: event.data.meta.user_id,
        provider: "flutterwave",
        reference: event.data.tx_ref ?? `flw_${Date.now()}`,
        amount: event.data.amount ?? 0,
        currency: event.data.currency ?? "USD",
        paidAt: event.data.created_at ?? new Date().toISOString(),
      });
    } catch (error) {
      console.error("Flutterwave webhook activation failed:", error);
      return NextResponse.json({ error: "Activation failed" }, { status: 500 });
    }
  }

  return NextResponse.json({ received: true });
}
