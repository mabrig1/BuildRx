import type { BillingProvider, VerifiedPayment } from "@/lib/billing/providers";
import { flutterwaveVerify, paystackVerify } from "@/lib/billing/providers";
import { COURSE_PRICE_NGN, COURSE_SLUG } from "@/lib/course/buildrx-tech-plus";

export class CoursePaymentError extends Error {}

/** A webhook is only a signal; provider verification supplies authoritative fields. */
export function isCourseCheckout(
  metadata: unknown,
  reference: unknown
): boolean {
  const m = metadata && typeof metadata === "object" && !Array.isArray(metadata)
    ? metadata as Record<string, unknown> : {};
  return m.product === COURSE_SLUG ||
    m.purchase_type === "one_time_course" ||
    (typeof reference === "string" && reference.startsWith("techplus_"));
}

/** Verify course, payer, amount, currency and checkout-issued reference together. */
export function verifiedCourseUserId(payment: VerifiedPayment): string {
  const meta = payment.metadata;
  const id = meta.user_id;
  if (typeof id !== "string" ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id) ||
      meta.product !== COURSE_SLUG ||
      meta.purchase_type !== "one_time_course") {
    throw new CoursePaymentError("Unrecognised course payment metadata");
  }
  if (!payment.reference.startsWith("techplus_" + id + "_") ||
      payment.reference.length > 180) {
    throw new CoursePaymentError("Payment reference is not tied to the learner");
  }
  if (payment.currency.toUpperCase() !== "NGN" ||
      !Number.isFinite(payment.amount) || payment.amount < COURSE_PRICE_NGN) {
    throw new CoursePaymentError("Payment amount or currency is invalid");
  }
  if (!payment.paidAt || Number.isNaN(new Date(payment.paidAt).getTime())) {
    throw new CoursePaymentError("Missing provider payment timestamp");
  }
  return id;
}

/**
 * One-time course entitlement. Never bypass authentication, issue a second
 * entitlement, or reinstate refunded/revoked enrollments automatically.
 * Only the trusted server-side service-role client can write this table.
 */
export async function activateVerifiedCoursePayment(params: {
  payment: VerifiedPayment;
  provider: BillingProvider;
  signedInUserId?: string;
}): Promise<void> {
  const userId = verifiedCourseUserId(params.payment);
  if (params.signedInUserId && params.signedInUserId !== userId) {
    throw new CoursePaymentError("Payment belongs to a different account");
  }
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new CoursePaymentError("Course enrollment service is not configured");
  }
  const { createAdminClient } = await import("@/lib/supabase/admin");
  const admin = createAdminClient();

  const lookup = async () => admin.from("course_enrollments")
    .select("id, status, provider_ref")
    .eq("user_id", userId).eq("course_slug", COURSE_SLUG).maybeSingle();

  const existing = await lookup();
  if (existing.error) throw new CoursePaymentError("Enrollment lookup failed");
  if (existing.data) {
    if (existing.data.status === "refunded" || existing.data.status === "revoked") {
      throw new CoursePaymentError("Previously revoked access requires administrator review");
    }
    // Repeat provider callbacks and webhook deliveries are idempotent.
    if (existing.data.status === "active" || existing.data.status === "completed") return;
    throw new CoursePaymentError("Unexpected enrollment state");
  }

  const insert = await admin.from("course_enrollments").insert({
    user_id: userId,
    course_slug: COURSE_SLUG,
    status: "active",
    provider: params.provider,
    provider_ref: params.payment.reference,
    amount: params.payment.amount,
    currency: "NGN",
    enrolled_at: params.payment.paidAt,
  });
  if (!insert.error) return;

  // A concurrent verified webhook/callback may have inserted the same row.
  if (insert.error.code === "23505") {
    const raced = await lookup();
    if (!raced.error && raced.data &&
        (raced.data.status === "active" || raced.data.status === "completed")) return;
  }
  throw new CoursePaymentError("Enrollment could not be saved");
}

/**
 * Called only after signature/authentication of the webhook itself.
 * Verify the transaction directly with the payment provider before writing.
 */
export async function fulfillCourseWebhook(params: {
  provider: BillingProvider;
  reference: string;
  transactionId?: string;
}): Promise<void> {
  if (!params.reference || !params.reference.startsWith("techplus_")) {
    throw new CoursePaymentError("Invalid course reference");
  }
  if (params.provider === "flutterwave" && !params.transactionId) {
    throw new CoursePaymentError("Missing Flutterwave transaction id");
  }
  const payment = params.provider === "paystack"
    ? await paystackVerify(params.reference)
    : await flutterwaveVerify(params.transactionId!);
  if (payment.reference !== params.reference) {
    throw new CoursePaymentError("Provider transaction does not match webhook reference");
  }
  await activateVerifiedCoursePayment({ payment, provider: params.provider });
}
