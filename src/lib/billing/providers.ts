import { createHmac } from "crypto";

/**
 * Payment provider adapters: Paystack and Flutterwave (server-only).
 * Both flows: initialize a hosted checkout → user pays → we verify the
 * transaction reference server-side (and/or receive a signed webhook).
 */

export type BillingProvider = "paystack" | "flutterwave";

export interface CheckoutInit {
  checkoutUrl: string;
  reference: string;
}

export interface VerifiedPayment {
  reference: string;
  amount: number;
  currency: string;
  paidAt: string;
  customerEmail: string | null;
}

export class BillingError extends Error {}

function currency() {
  return process.env.BILLING_CURRENCY ?? "USD";
}

export function isPaystackConfigured() {
  return Boolean(process.env.PAYSTACK_SECRET_KEY);
}

export function isFlutterwaveConfigured() {
  return Boolean(process.env.FLUTTERWAVE_SECRET_KEY);
}

// ------------------------------------------------------------------
// Paystack
// ------------------------------------------------------------------

export async function paystackInitialize(params: {
  email: string;
  amountUsd: number;
  reference: string;
  callbackUrl: string;
  metadata: Record<string, unknown>;
}): Promise<CheckoutInit> {
  const response = await fetch("https://api.paystack.co/transaction/initialize", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      email: params.email,
      // Paystack expects the smallest currency unit.
      amount: Math.round(params.amountUsd * 100),
      currency: currency(),
      reference: params.reference,
      callback_url: params.callbackUrl,
      metadata: params.metadata,
      // Optional Paystack Plan code enables provider-side auto-renewal.
      ...(process.env.PAYSTACK_PLAN_CODE_PRO
        ? { plan: process.env.PAYSTACK_PLAN_CODE_PRO }
        : {}),
    }),
  });
  const data = await response.json().catch(() => null);
  if (!response.ok || !data?.status) {
    throw new BillingError(
      data?.message ?? `Paystack initialize failed (${response.status})`
    );
  }
  return {
    checkoutUrl: data.data.authorization_url,
    reference: data.data.reference,
  };
}

export async function paystackVerify(
  reference: string
): Promise<VerifiedPayment> {
  const response = await fetch(
    `https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`,
    {
      headers: {
        Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
      },
    }
  );
  const data = await response.json().catch(() => null);
  if (!response.ok || !data?.status || data?.data?.status !== "success") {
    throw new BillingError(
      data?.data?.gateway_response ?? "Paystack payment not successful"
    );
  }
  return {
    reference: data.data.reference,
    amount: (data.data.amount ?? 0) / 100,
    currency: data.data.currency ?? currency(),
    paidAt: data.data.paid_at ?? new Date().toISOString(),
    customerEmail: data.data.customer?.email ?? null,
  };
}

/** Paystack webhook signature: HMAC-SHA512 of the raw body. */
export function paystackVerifySignature(
  rawBody: string,
  signature: string | null
): boolean {
  const secret = process.env.PAYSTACK_SECRET_KEY;
  if (!secret || !signature) return false;
  const expected = createHmac("sha512", secret).update(rawBody).digest("hex");
  return expected === signature;
}

// ------------------------------------------------------------------
// Flutterwave
// ------------------------------------------------------------------

export async function flutterwaveInitialize(params: {
  email: string;
  amountUsd: number;
  reference: string;
  callbackUrl: string;
  metadata: Record<string, unknown>;
}): Promise<CheckoutInit> {
  const response = await fetch("https://api.flutterwave.com/v3/payments", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.FLUTTERWAVE_SECRET_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      tx_ref: params.reference,
      amount: params.amountUsd,
      currency: currency(),
      redirect_url: params.callbackUrl,
      customer: { email: params.email },
      meta: params.metadata,
      customizations: { title: "App-Creator Pro" },
    }),
  });
  const data = await response.json().catch(() => null);
  if (!response.ok || data?.status !== "success") {
    throw new BillingError(
      data?.message ?? `Flutterwave initialize failed (${response.status})`
    );
  }
  return { checkoutUrl: data.data.link, reference: params.reference };
}

export async function flutterwaveVerify(
  transactionId: string
): Promise<VerifiedPayment> {
  const response = await fetch(
    `https://api.flutterwave.com/v3/transactions/${encodeURIComponent(transactionId)}/verify`,
    {
      headers: {
        Authorization: `Bearer ${process.env.FLUTTERWAVE_SECRET_KEY}`,
      },
    }
  );
  const data = await response.json().catch(() => null);
  if (
    !response.ok ||
    data?.status !== "success" ||
    data?.data?.status !== "successful"
  ) {
    throw new BillingError("Flutterwave payment not successful");
  }
  return {
    reference: data.data.tx_ref,
    amount: data.data.amount ?? 0,
    currency: data.data.currency ?? currency(),
    paidAt: data.data.created_at ?? new Date().toISOString(),
    customerEmail: data.data.customer?.email ?? null,
  };
}

/** Flutterwave webhook: verif-hash header must equal the secret hash. */
export function flutterwaveVerifySignature(
  signature: string | null
): boolean {
  const hash = process.env.FLUTTERWAVE_SECRET_HASH;
  return Boolean(hash && signature && signature === hash);
}
