import { describe, expect, it } from "vitest";

import { rateLimit, rateLimitHeaders } from "@/lib/rate-limit";

function uniqueKey(prefix: string) {
  return `${prefix}:${Math.random().toString(36).slice(2)}`;
}

describe("rateLimit", () => {
  it("allows requests up to the limit, then rejects", () => {
    const key = uniqueKey("basic");
    const opts = { limit: 3, windowMs: 60_000 };

    expect(rateLimit(key, opts).success).toBe(true);
    expect(rateLimit(key, opts).success).toBe(true);
    const third = rateLimit(key, opts);
    expect(third.success).toBe(true);
    expect(third.remaining).toBe(0);

    const fourth = rateLimit(key, opts);
    expect(fourth.success).toBe(false);
    expect(fourth.remaining).toBe(0);
  });

  it("tracks separate keys independently", () => {
    const opts = { limit: 1, windowMs: 60_000 };
    const a = uniqueKey("a");
    const b = uniqueKey("b");

    expect(rateLimit(a, opts).success).toBe(true);
    expect(rateLimit(a, opts).success).toBe(false);
    expect(rateLimit(b, opts).success).toBe(true);
  });

  it("reports decreasing remaining counts", () => {
    const key = uniqueKey("remaining");
    const opts = { limit: 5, windowMs: 60_000 };

    expect(rateLimit(key, opts).remaining).toBe(4);
    expect(rateLimit(key, opts).remaining).toBe(3);
    expect(rateLimit(key, opts).remaining).toBe(2);
  });
});

describe("rateLimitHeaders", () => {
  it("omits Retry-After on success", () => {
    const headers = rateLimitHeaders({
      success: true,
      limit: 10,
      remaining: 5,
      reset: Date.now() + 30_000,
    }) as Record<string, string>;

    expect(headers["X-RateLimit-Limit"]).toBe("10");
    expect(headers["X-RateLimit-Remaining"]).toBe("5");
    expect(headers["Retry-After"]).toBeUndefined();
  });

  it("includes a positive Retry-After on rejection", () => {
    const headers = rateLimitHeaders({
      success: false,
      limit: 10,
      remaining: 0,
      reset: Date.now() + 15_000,
    }) as Record<string, string>;

    expect(headers["Retry-After"]).toBeDefined();
    expect(Number(headers["Retry-After"])).toBeGreaterThan(0);
  });
});
