import { createHmac } from "node:crypto";

import { afterEach, describe, expect, it, vi } from "vitest";

import {
  flutterwaveVerifySignature,
  isFlutterwaveConfigured,
  isPaystackConfigured,
  paystackVerifySignature,
} from "@/lib/billing/providers";

const SECRET = "sk_test_paystack_secret";

function sign(body: string, secret = SECRET) {
  return createHmac("sha512", secret).update(body).digest("hex");
}

const savedEnv = { ...process.env };

afterEach(() => {
  process.env = { ...savedEnv };
  vi.unstubAllGlobals();
});

// ------------------------------------------------------------------
// These two functions are the entire authentication boundary in front
// of an endpoint that grants paid subscriptions. Every case below is
// "does an unauthenticated caller get in".
// ------------------------------------------------------------------

describe("paystackVerifySignature", () => {
  it("accepts a correct HMAC-SHA512 of the raw body", () => {
    process.env.PAYSTACK_SECRET_KEY = SECRET;
    const body = JSON.stringify({ event: "charge.success" });
    expect(paystackVerifySignature(body, sign(body))).toBe(true);
  });

  it("rejects a signature computed with a different secret", () => {
    process.env.PAYSTACK_SECRET_KEY = SECRET;
    const body = JSON.stringify({ event: "charge.success" });
    expect(paystackVerifySignature(body, sign(body, "wrong_secret"))).toBe(
      false
    );
  });

  it("rejects a signature over different bytes", () => {
    process.env.PAYSTACK_SECRET_KEY = SECRET;
    const signature = sign(JSON.stringify({ amount: 100 }));
    expect(
      paystackVerifySignature(JSON.stringify({ amount: 999999 }), signature)
    ).toBe(false);
  });

  it("is sensitive to re-serialisation — the raw body must be used", () => {
    process.env.PAYSTACK_SECRET_KEY = SECRET;
    const raw = '{"event":"charge.success","data":{"amount":1000}}';
    const reserialised = JSON.stringify(JSON.parse(raw) as unknown, null, 2);
    const signature = sign(raw);

    expect(paystackVerifySignature(raw, signature)).toBe(true);
    expect(paystackVerifySignature(reserialised, signature)).toBe(false);
  });

  describe("rejects malformed signatures", () => {
    it.each([
      ["null", null],
      ["empty", ""],
      ["truncated", sign("{}").slice(0, 32)],
      ["over-long", `${sign("{}")}00`],
      ["not hex", "z".repeat(128)],
    ])("%s", (_label, signature) => {
      process.env.PAYSTACK_SECRET_KEY = SECRET;
      expect(paystackVerifySignature("{}", signature)).toBe(false);
    });
  });

  /**
   * The length-mismatch branch returns early and never reaches
   * timingSafeEqual (which throws on unequal lengths). That early return
   * must stay `false` — inverting it, or letting the throw escape, opens
   * the endpoint.
   */
  it("returns false rather than throwing on a length mismatch", () => {
    process.env.PAYSTACK_SECRET_KEY = SECRET;
    expect(() => paystackVerifySignature("{}", "abc")).not.toThrow();
    expect(paystackVerifySignature("{}", "abc")).toBe(false);
  });

  it("fails closed when the secret is not configured", () => {
    delete process.env.PAYSTACK_SECRET_KEY;
    const body = "{}";
    // Even a signature the caller computed correctly for *some* secret
    // must not authenticate a deployment that has none.
    expect(paystackVerifySignature(body, sign(body))).toBe(false);
  });

  it("fails closed when the secret is an empty string", () => {
    process.env.PAYSTACK_SECRET_KEY = "";
    expect(paystackVerifySignature("{}", sign("{}", ""))).toBe(false);
  });
});

describe("flutterwaveVerifySignature", () => {
  it("accepts the configured secret hash", () => {
    process.env.FLUTTERWAVE_SECRET_HASH = "flw_hash_value";
    expect(flutterwaveVerifySignature("flw_hash_value")).toBe(true);
  });

  describe("rejects anything else", () => {
    it.each([
      ["a different hash of equal length", "flw_hash_wrong"],
      ["a prefix of the hash", "flw_hash"],
      ["a superstring of the hash", "flw_hash_value_extra"],
      ["null", null],
      ["empty", ""],
    ])("%s", (_label, signature) => {
      process.env.FLUTTERWAVE_SECRET_HASH = "flw_hash_value";
      expect(flutterwaveVerifySignature(signature)).toBe(false);
    });
  });

  it("fails closed when the hash is not configured", () => {
    delete process.env.FLUTTERWAVE_SECRET_HASH;
    expect(flutterwaveVerifySignature("anything")).toBe(false);
    expect(flutterwaveVerifySignature("")).toBe(false);
  });

  it("fails closed when the hash is an empty string", () => {
    process.env.FLUTTERWAVE_SECRET_HASH = "";
    expect(flutterwaveVerifySignature("")).toBe(false);
  });
});

describe("provider configuration flags", () => {
  it("reports Paystack configured only with a secret key", () => {
    delete process.env.PAYSTACK_SECRET_KEY;
    expect(isPaystackConfigured()).toBe(false);
    process.env.PAYSTACK_SECRET_KEY = SECRET;
    expect(isPaystackConfigured()).toBe(true);
  });

  it("reports Flutterwave configured only with a secret key", () => {
    delete process.env.FLUTTERWAVE_SECRET_KEY;
    expect(isFlutterwaveConfigured()).toBe(false);
    process.env.FLUTTERWAVE_SECRET_KEY = "flw_secret";
    expect(isFlutterwaveConfigured()).toBe(true);
  });
});
