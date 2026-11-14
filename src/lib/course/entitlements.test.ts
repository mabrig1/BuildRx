import { describe, expect, it, vi, beforeEach } from "vitest";
import type { VerifiedPayment } from "@/lib/billing/providers";
import { COURSE_SLUG } from "@/lib/course/buildrx-tech-plus";

const { mockVerify, mockFlutterwave, mockAdmin, mockCreateAdmin } = vi.hoisted(() => {
  const mockVerify = vi.fn();
  const mockFlutterwave = vi.fn();
  const mockAdmin = { from: vi.fn() };
  return { mockVerify, mockFlutterwave, mockAdmin, mockCreateAdmin: vi.fn(() => mockAdmin) };
});
vi.mock("@/lib/billing/providers", () => ({
  paystackVerify: mockVerify, flutterwaveVerify: mockFlutterwave,
}));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: mockCreateAdmin }));

import { activateVerifiedCoursePayment, fulfillCourseWebhook,
  isCourseCheckout, verifiedCourseUserId } from "./entitlements";

const id = "9aa6ce88-9e87-492c-b704-5bd89e01fb89";
const payment: VerifiedPayment = {
  reference: "techplus_" + id + "_a1b2c3d4",
  amount: 100000, currency: "NGN", paidAt: "2026-11-14T05:00:00Z",
  customerEmail: "student@example.com",
  metadata: { user_id: id, product: COURSE_SLUG, purchase_type: "one_time_course" },
};
const oldSecret = process.env.SUPABASE_SERVICE_ROLE_KEY;
beforeEach(() => {
  vi.clearAllMocks();
  process.env.SUPABASE_SERVICE_ROLE_KEY = "test_service_role";
  mockVerify.mockResolvedValue(payment);
  mockFlutterwave.mockResolvedValue(payment);
});
afterEach(() => {
  if (oldSecret === undefined) delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  else process.env.SUPABASE_SERVICE_ROLE_KEY = oldSecret;
});

describe("course purchase discrimination", () => {
  it("recognises one-time course events but not Pro subscriptions", () => {
    expect(isCourseCheckout({ product: COURSE_SLUG }, "unrelated")).toBe(true);
    expect(isCourseCheckout({}, payment.reference)).toBe(true);
    expect(isCourseCheckout({ user_id: id }, "pro_999")).toBe(false);
  });
  it("accepts only provider-verified course, learner, and NGN 100000", () => {
    expect(verifiedCourseUserId(payment)).toBe(id);
    for (const invalid of [
      { amount: 100 },
      { currency: "USD" },
      { metadata: { ...payment.metadata, product: "other" } },
      { metadata: { ...payment.metadata, purchase_type: "subscription" } },
      { reference: "techplus_" + "a".repeat(36) + "_bad" },
      { metadata: { ...payment.metadata, user_id: "spoofed" } },
    ]) expect(() => verifiedCourseUserId({ ...payment, ...invalid })).toThrow();
  });
});
describe("trusted, idempotent entitlement activation", () => {
  const makeAdmin = (existing: { status: string; provider_ref?: string } | null = null) => {
    const maybeSingle = vi.fn().mockResolvedValue({ data: existing, error: null });
    const select = vi.fn(() => ({ eq: () => ({ eq: () => ({ maybeSingle }) }) }));
    const insert = vi.fn().mockResolvedValue({ error: null });
    mockAdmin.from.mockImplementation((table: string) => {
      expect(table).toBe("course_enrollments");
      return { select, insert };
    });
    return { insert, maybeSingle };
  };
  it("writes once for valid payment and does not affect the SaaS plan", async () => {
    const db = makeAdmin();
    await activateVerifiedCoursePayment({ payment, provider: "paystack", signedInUserId: id });
    expect(db.insert).toHaveBeenCalledWith(expect.objectContaining({
      user_id: id, course_slug: COURSE_SLUG, status: "active", amount: 100000,
    }));
    expect(db.insert).toHaveBeenCalledTimes(1);
  });
  it("does not reactivate revoked or refunded enrollments", async () => {
    for (const status of ["revoked", "refunded"]) {
      const db = makeAdmin({ status });
      await expect(activateVerifiedCoursePayment({ payment, provider: "paystack" })).rejects.toThrow();
      expect(db.insert).not.toHaveBeenCalled();
    }
  });
  it("ignores repeated deliveries and rejects another account", async () => {
    const db = makeAdmin({ status: "active", provider_ref: payment.reference });
    await activateVerifiedCoursePayment({ payment, provider: "paystack" });
    expect(db.insert).not.toHaveBeenCalled();
    await expect(activateVerifiedCoursePayment({
      payment, provider: "paystack", signedInUserId: "different-user",
    })).rejects.toThrow();
  });
  it("verifies transactions by provider and matches the callback reference", async () => {
    makeAdmin();
    await fulfillCourseWebhook({ provider: "paystack", reference: payment.reference });
    expect(mockVerify).toHaveBeenCalledWith(payment.reference);
    mockVerify.mockResolvedValueOnce({ ...payment, reference: "wrong_ref" });
    await expect(fulfillCourseWebhook({ provider: "paystack", reference: payment.reference })).rejects.toThrow();
    await fulfillCourseWebhook({ provider: "flutterwave", reference: payment.reference, transactionId: "123" });
    expect(mockFlutterwave).toHaveBeenCalledWith("123");
  });
  it("fails closed when provider ID or server entitlement key is absent", async () => {
    await expect(fulfillCourseWebhook({ provider: "flutterwave", reference: payment.reference })).rejects.toThrow();
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    await expect(activateVerifiedCoursePayment({ payment, provider: "paystack" })).rejects.toThrow();
  });
});
