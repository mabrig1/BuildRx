import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { POST } from "./route";

const activateProSubscription = vi.hoisted(() => vi.fn());
vi.mock("@/lib/billing/service", () => ({ activateProSubscription }));

const HASH = "flw_secret_hash_value";
const savedEnv = { ...process.env };

function webhook(payload: unknown, signature: string | null = HASH) {
  const headers = new Headers();
  if (signature !== null) headers.set("verif-hash", signature);
  return new Request("https://app.example/api/billing/webhooks/flutterwave", {
    method: "POST",
    headers,
    body: JSON.stringify(payload),
  });
}

const chargeCompleted = {
  event: "charge.completed",
  data: {
    tx_ref: "tx_abc123",
    amount: 29,
    currency: "USD",
    created_at: "2026-07-01T12:00:00.000Z",
    status: "successful",
    meta: { user_id: "user-1" },
  },
};

beforeEach(() => {
  process.env.FLUTTERWAVE_SECRET_HASH = HASH;
  activateProSubscription.mockReset().mockResolvedValue(undefined);
});

afterEach(() => {
  process.env = { ...savedEnv };
  vi.restoreAllMocks();
});

describe("POST /api/billing/webhooks/flutterwave", () => {
  describe("authentication", () => {
    it("activates the subscription for a valid hash and successful charge", async () => {
      const response = await POST(webhook(chargeCompleted));

      expect(response.status).toBe(200);
      await expect(response.json()).resolves.toEqual({ received: true });
      expect(activateProSubscription).toHaveBeenCalledWith({
        userId: "user-1",
        provider: "flutterwave",
        reference: "tx_abc123",
        amount: 29,
        currency: "USD",
        paidAt: "2026-07-01T12:00:00.000Z",
      });
    });

    it("rejects a request with no verif-hash header", async () => {
      const response = await POST(webhook(chargeCompleted, null));

      expect(response.status).toBe(401);
      expect(activateProSubscription).not.toHaveBeenCalled();
    });

    it("rejects a wrong hash", async () => {
      const response = await POST(webhook(chargeCompleted, "wrong_hash_value"));

      expect(response.status).toBe(401);
      expect(activateProSubscription).not.toHaveBeenCalled();
    });

    it("rejects a prefix of the correct hash", async () => {
      const response = await POST(webhook(chargeCompleted, "flw_secret"));

      expect(response.status).toBe(401);
    });

    it("rejects everything when the hash is not configured", async () => {
      delete process.env.FLUTTERWAVE_SECRET_HASH;
      const response = await POST(webhook(chargeCompleted, "anything"));

      expect(response.status).toBe(401);
      expect(activateProSubscription).not.toHaveBeenCalled();
    });
  });

  describe("payload handling", () => {
    it("returns 400 for an unparseable body", async () => {
      const request = new Request("https://app.example/webhook", {
        method: "POST",
        headers: { "verif-hash": HASH },
        body: "not json",
      });
      const response = await POST(request);

      expect(response.status).toBe(400);
      expect(activateProSubscription).not.toHaveBeenCalled();
    });

    it("ignores a charge that did not succeed", async () => {
      const response = await POST(
        webhook({
          ...chargeCompleted,
          data: { ...chargeCompleted.data, status: "failed" },
        })
      );

      expect(response.status).toBe(200);
      expect(activateProSubscription).not.toHaveBeenCalled();
    });

    it("ignores unrelated events", async () => {
      const response = await POST(
        webhook({ ...chargeCompleted, event: "transfer.completed" })
      );

      expect(activateProSubscription).not.toHaveBeenCalled();
      expect(response.status).toBe(200);
    });

    it("ignores a successful charge with no user_id in meta", async () => {
      const response = await POST(
        webhook({
          ...chargeCompleted,
          data: { ...chargeCompleted.data, meta: {} },
        })
      );

      expect(activateProSubscription).not.toHaveBeenCalled();
      expect(response.status).toBe(200);
    });

    it("passes the amount through unscaled, unlike Paystack", async () => {
      // Flutterwave reports major units; Paystack reports minor units.
      // Mixing the two up would charge or credit 100x.
      await POST(
        webhook({
          ...chargeCompleted,
          data: { ...chargeCompleted.data, amount: 150 },
        })
      );

      expect(activateProSubscription).toHaveBeenCalledWith(
        expect.objectContaining({ amount: 150 })
      );
    });

    it("returns 500 when activation fails, so the provider retries", async () => {
      vi.spyOn(console, "error").mockImplementation(() => {});
      activateProSubscription.mockRejectedValue(new Error("db down"));

      const response = await POST(webhook(chargeCompleted));

      expect(response.status).toBe(500);
    });
  });

  /** See docs/test-coverage-analysis.md — recorded, not endorsed. */
  describe("known gaps", () => {
    it("does not check the amount against the Pro plan price", async () => {
      await POST(
        webhook({
          ...chargeCompleted,
          data: { ...chargeCompleted.data, amount: 0.01 },
        })
      );

      expect(activateProSubscription).toHaveBeenCalledWith(
        expect.objectContaining({ amount: 0.01 })
      );
    });

    it("synthesises a reference when tx_ref is absent", async () => {
      await POST(
        webhook({
          ...chargeCompleted,
          data: { ...chargeCompleted.data, tx_ref: undefined },
        })
      );

      const { reference } = activateProSubscription.mock.calls[0][0];
      expect(reference).toMatch(/^flw_\d+$/);
    });
  });
});
