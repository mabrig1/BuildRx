import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The sliding-window store and the cleanup timestamp are module-level,
 * so every test needs a fresh module instance.
 */
async function freshModule() {
  vi.resetModules();
  return import("@/lib/rate-limit");
}

const NOW = 1_700_000_000_000;
const MINUTE = 60_000;

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
});

afterEach(() => {
  vi.useRealTimers();
});

describe("rateLimit", () => {
  const options = { limit: 3, windowMs: MINUTE };

  it("allows requests up to the limit", async () => {
    const { rateLimit } = await freshModule();

    expect(rateLimit("user-1", options)).toMatchObject({
      success: true,
      limit: 3,
      remaining: 2,
    });
    expect(rateLimit("user-1", options)).toMatchObject({
      success: true,
      remaining: 1,
    });
    expect(rateLimit("user-1", options)).toMatchObject({
      success: true,
      remaining: 0,
    });
  });

  it("rejects the request that exceeds the limit", async () => {
    const { rateLimit } = await freshModule();
    for (let i = 0; i < 3; i++) rateLimit("user-1", options);

    expect(rateLimit("user-1", options)).toMatchObject({
      success: false,
      remaining: 0,
    });
  });

  it("does not count a rejected request against the window", async () => {
    // Otherwise a client hammering a closed door would extend its own
    // lockout indefinitely.
    const { rateLimit } = await freshModule();
    for (let i = 0; i < 3; i++) rateLimit("user-1", options);

    rateLimit("user-1", options);
    rateLimit("user-1", options);

    vi.setSystemTime(NOW + MINUTE + 1);
    expect(rateLimit("user-1", options)).toMatchObject({ success: true });
  });

  it("keys are independent", async () => {
    const { rateLimit } = await freshModule();
    for (let i = 0; i < 3; i++) rateLimit("user-1", options);

    expect(rateLimit("user-2", options)).toMatchObject({
      success: true,
      remaining: 2,
    });
  });

  describe("the sliding window", () => {
    it("still blocks at the last moment inside the window", async () => {
      const { rateLimit } = await freshModule();
      for (let i = 0; i < 3; i++) rateLimit("user-1", options);

      vi.setSystemTime(NOW + MINUTE - 1);
      expect(rateLimit("user-1", options)).toMatchObject({ success: false });
    });

    it("admits a request once the oldest entry ages out", async () => {
      // The window is exclusive at its lower bound (`t > now - windowMs`),
      // so an entry exactly windowMs old has already left it.
      const { rateLimit } = await freshModule();
      for (let i = 0; i < 3; i++) rateLimit("user-1", options);

      vi.setSystemTime(NOW + MINUTE);
      expect(rateLimit("user-1", options)).toMatchObject({
        success: true,
        remaining: 2,
      });
    });

    it("slides rather than resetting in fixed buckets", async () => {
      const { rateLimit } = await freshModule();
      rateLimit("user-1", options); // t=0
      vi.setSystemTime(NOW + 30_000);
      rateLimit("user-1", options); // t=30s
      rateLimit("user-1", options); // t=30s

      // t=61s: only the first entry has aged out, so exactly one slot.
      vi.setSystemTime(NOW + MINUTE + 1_000);
      expect(rateLimit("user-1", options)).toMatchObject({ success: true });
      expect(rateLimit("user-1", options)).toMatchObject({ success: false });
    });
  });

  describe("reset", () => {
    it("points at the moment the oldest counted request leaves", async () => {
      const { rateLimit } = await freshModule();
      expect(rateLimit("user-1", options).reset).toBe(NOW + MINUTE);
    });

    it("is derived from the oldest surviving entry, not the newest", async () => {
      const { rateLimit } = await freshModule();
      rateLimit("user-1", options); // t=0
      vi.setSystemTime(NOW + 20_000);

      expect(rateLimit("user-1", options).reset).toBe(NOW + MINUTE);
    });
  });
});

describe("rateLimitHeaders", () => {
  it("reports limit, remaining, and reset in seconds", async () => {
    const { rateLimit, rateLimitHeaders } = await freshModule();
    const result = rateLimit("user-1", { limit: 20, windowMs: MINUTE });

    expect(rateLimitHeaders(result)).toEqual({
      "X-RateLimit-Limit": "20",
      "X-RateLimit-Remaining": "19",
      "X-RateLimit-Reset": String(Math.ceil((NOW + MINUTE) / 1000)),
    });
  });

  it("omits Retry-After while the request is allowed", async () => {
    const { rateLimit, rateLimitHeaders } = await freshModule();
    const headers = rateLimitHeaders(
      rateLimit("user-1", { limit: 5, windowMs: MINUTE })
    );

    expect(headers).not.toHaveProperty("Retry-After");
  });

  it("adds Retry-After once the limit is exceeded", async () => {
    const { rateLimit, rateLimitHeaders } = await freshModule();
    const options = { limit: 1, windowMs: MINUTE };
    rateLimit("user-1", options);

    vi.setSystemTime(NOW + 20_000);
    const headers = rateLimitHeaders(rateLimit("user-1", options)) as Record<
      string,
      string
    >;

    expect(headers["Retry-After"]).toBe("40");
  });

  it("never advertises a Retry-After below one second", async () => {
    const { rateLimit, rateLimitHeaders } = await freshModule();
    const options = { limit: 1, windowMs: MINUTE };
    rateLimit("user-1", options);

    vi.setSystemTime(NOW + MINUTE - 1);
    const headers = rateLimitHeaders(rateLimit("user-1", options)) as Record<
      string,
      string
    >;

    expect(headers["Retry-After"]).toBe("1");
  });
});

describe("stale-key cleanup", () => {
  it("drops keys that have aged out, bounding the map", async () => {
    const { rateLimit } = await freshModule();
    const options = { limit: 3, windowMs: MINUTE };
    rateLimit("old-user", options);

    // Past the 5-minute cleanup interval: the next call sweeps the map.
    vi.setSystemTime(NOW + 6 * MINUTE);
    rateLimit("new-user", options);

    // old-user was evicted, so it starts from a full allowance.
    expect(rateLimit("old-user", options)).toMatchObject({ remaining: 2 });
  });

  /**
   * Known latent bug, pinned so it is visible before it bites.
   *
   * The cleanup pass evicts stale keys using *the current call's*
   * windowMs, applied to every key in the shared module-level map. Every
   * call site uses a 60s window today, so this is benign — but the first
   * limiter added with a longer window will have its live entries
   * evicted by any 60s-window call that happens to trigger the sweep.
   *
   * Fix when it matters: store windowMs alongside each entry and evict
   * against the entry's own window.
   */
  it("evicts another limiter's live entries when windows differ", async () => {
    const { rateLimit } = await freshModule();
    const hourly = { limit: 5, windowMs: 60 * MINUTE };
    const perMinute = { limit: 5, windowMs: MINUTE };

    expect(rateLimit("hourly-key", hourly)).toMatchObject({ remaining: 4 });

    // A 60s-window call triggers the sweep and judges hourly-key stale.
    vi.setSystemTime(NOW + 6 * MINUTE);
    rateLimit("minute-key", perMinute);

    // Still well inside its own hour, so this should be the 2nd of 5
    // (remaining 3). It reports 4 — the earlier request was erased.
    expect(rateLimit("hourly-key", hourly)).toMatchObject({ remaining: 4 });
  });
});
