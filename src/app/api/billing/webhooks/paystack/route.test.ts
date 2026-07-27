import { createHmac } from "node:crypto";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { POST } from "./route";

const activateProSubscription = vi.hoisted(() => vi.fn());
vi.mock("@/lib/billing/service", () => ({ activateProSubscription }));

const SECRET = "sk_test_paystack_secret";
const savedEnv = { ...process.env };

function sign(body: string) {
  return createHmac("sha512", SECRET).update(body).digest("hex");
}

/** A signed request, as Paystack would send it. */
function webhook(payload: unknown, signature?: string | null) {
  const body = JSON.stringify(payload);
  const headers = new Headers();
  const value = signature === undefined ? sign(body) : signature;
  if (value !== null) headers.set("x-paystack-signature", value);
  return new Request("https://app.example/api/billing/webhooks/paystack", {
    method: "POST",
    headers,
    body,
  });
}

const chargeSuccess = {
  event: "charge.success",
  data: {
    reference: "ref_abc123",
    amount: 2900, // kobo/cents — 29.00
    currency: "USD",
    paid_at: "2026-07-01T12:00:00.000Z",
    metadata: { user_id: "user-1" },
  },
};

beforeEach(() => {
  process.env.PAYSTACK_SECRET_KEY = SECRET;
  activateProSubscription.mockReset().mockResolvedValue(undefined);
});

afterEach(() => {
  process.env = { ...savedEnv };
  vi.restoreAllMocks();
});

describe("POST /api/billing/webhooks/paystack", () => {
  describe("authentication", () => {
    it("activates the subscription for a correctly signed charge.success", async () => {
      const response = await POST(webhook(chargeSuccess));

      expect(response.status).toBe(200);
      await expect(response.json()).resolves.toEqual({ received: true });
      expect(activateProSubscription).toHaveBeenCalledOnce();
      expect(activateProSubscription).toHaveBeenCalledWith({
        userId: "user-1",
        provider: "paystack",
        reference: "ref_abc123",
        amount: 29,
        currency: "USD",
        paidAt: "2026-07-01T12:00:00.000Z",
      });
    });

    it("rejects an unsigned request without activating anything", async () => {
      const response = await POST(webhook(chargeSuccess, null));

      expect(response.status).toBe(401);
      expect(activateProSubscription).not.toHaveBeenCalled();
    });

    it("rejects a forged signature", async () => {
      const response = await POST(webhook(chargeSuccess, "f".repeat(128)));

      expect(response.status).toBe(401);
      expect(activateProSubscription).not.toHaveBeenCalled();
    });

    it("rejects a signature captured from a different payload", async () => {
      const stolen = sign(JSON.stringify({ event: "charge.success" }));
      const response = await POST(webhook(chargeSuccess, stolen));

      expect(response.status).toBe(401);
      expect(activateProSubscription).not.toHaveBeenCalled();
    });

    it("rejects everything when the secret is not configured", async () => {
      delete process.env.PAYSTACK_SECRET_KEY;
      const response = await POST(webhook(chargeSuccess, "anything"));

      expect(response.status).toBe(401);
      expect(activateProSubscription).not.toHaveBeenCalled();
    });

    it("verifies the signature before parsing the body", async () => {
      // Malformed JSON with no signature must fail auth (401), not
      // parsing (400) — the order matters for what an attacker learns.
      const body = "not json at all";
      const request = new Request("https://app.example/webhook", {
        method: "POST",
        body,
      });
      const response = await POST(request);

      expect(response.status).toBe(401);
    });
  });

  describe("payload handling", () => {
    it("returns 400 for a signed but unparseable body", async () => {
      const body = "not json at all";
      const request = new Request("https://app.example/webhook", {
        method: "POST",
        headers: { "x-paystack-signature": sign(body) },
        body,
      });
      const response = await POST(request);

      expect(response.status).toBe(400);
      expect(activateProSubscription).not.toHaveBeenCalled();
    });

    it("acknowledges unrelated events without activating", async () => {
      const response = await POST(
        webhook({ event: "charge.failed", data: { metadata: { user_id: "u" } } })
      );

      expect(response.status).toBe(200);
      expect(activateProSubscription).not.toHaveBeenCalled();
    });

    it("ignores charge.success with no user_id in metadata", async () => {
      const response = await POST(
        webhook({ event: "charge.success", data: { reference: "r" } })
      );

      expect(response.status).toBe(200);
      expect(activateProSubscription).not.toHaveBeenCalled();
    });

    it("converts the smallest currency unit to a major-unit amount", async () => {
      await POST(
        webhook({
          ...chargeSuccess,
          data: { ...chargeSuccess.data, amount: 150_00 },
        })
      );

      expect(activateProSubscription).toHaveBeenCalledWith(
        expect.objectContaining({ amount: 150 })
      );
    });

    it("returns 500 when activation fails, so the provider retries", async () => {
      vi.spyOn(console, "error").mockImplementation(() => {});
      activateProSubscription.mockRejectedValue(new Error("db down"));

      const response = await POST(webhook(chargeSuccess));

      expect(response.status).toBe(500);
    });

    it("does not log the raw event when activation fails", async () => {
      const consoleError = vi
        .spyOn(console, "error")
        .mockImplementation(() => {});
      activateProSubscription.mockRejectedValue(new Error("db down"));

      await POST(webhook(chargeSuccess));

      const logged = consoleError.mock.calls.flat().join(" ");
      expect(logged).not.toContain("user-1");
      expect(logged).not.toContain(SECRET);
    });
  });

  /**
   * Gaps in the current handler, pinned so they are visible rather than
   * discovered. Both are recorded behaviour, not endorsements — see
   * docs/test-coverage-analysis.md.
   */
  describe("known gaps", () => {
    it("does not check the amount against the Pro plan price", async () => {
      // A signed charge.success for one cent activates a full Pro
      // subscription. Only reachable with a valid signature, so it is a
      // correctness gap rather than an open door.
      await POST(
        webhook({
          ...chargeSuccess,
          data: { ...chargeSuccess.data, amount: 1 },
        })
      );

      expect(activateProSubscription).toHaveBeenCalledWith(
        expect.objectContaining({ amount: 0.01 })
      );
    });

    it("defaults a missing amount to zero instead of rejecting", async () => {
      await POST(
        webhook({
          event: "charge.success",
          data: { reference: "r", metadata: { user_id: "user-1" } },
        })
      );

      expect(activateProSubscription).toHaveBeenCalledWith(
        expect.objectContaining({ amount: 0, currency: "USD" })
      );
    });

    it("synthesises a reference when the provider omits one", async () => {
      // A synthesised reference is unique per call, which defeats the
      // reference-keyed idempotency on the invoice insert downstream.
      await POST(
        webhook({
          event: "charge.success",
          data: { amount: 2900, metadata: { user_id: "user-1" } },
        })
      );

      const { reference } = activateProSubscription.mock.calls[0][0];
      expect(reference).toMatch(/^ps_\d+$/);
    });
  });
});
