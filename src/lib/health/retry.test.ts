import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * `circuitBreakers` is a module-level singleton shared by every health
 * check, so each test needs its own module instance to avoid inheriting
 * another test's failure counts.
 */
async function freshModule() {
  vi.resetModules();
  return import("@/lib/health/retry");
}

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("withRetry", () => {
  beforeEach(() => {
    // Full jitter multiplies the backoff by Math.random(); pin it so the
    // delays under fake timers are deterministic.
    vi.spyOn(Math, "random").mockReturnValue(0.5);
  });

  it("returns the first successful result without retrying", async () => {
    const { withRetry } = await freshModule();
    const fn = vi.fn().mockResolvedValue("ok");

    await expect(withRetry(fn)).resolves.toBe("ok");
    expect(fn).toHaveBeenCalledOnce();
  });

  it("retries until it succeeds", async () => {
    const { withRetry } = await freshModule();
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new Error("boom"))
      .mockRejectedValueOnce(new Error("boom"))
      .mockResolvedValue("ok");

    await expect(withRetry(fn, { baseDelayMs: 0 })).resolves.toBe("ok");
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it("gives up after the configured attempt count and rethrows", async () => {
    const { withRetry } = await freshModule();
    const error = new Error("still broken");
    const fn = vi.fn().mockRejectedValue(error);

    await expect(withRetry(fn, { attempts: 4, baseDelayMs: 0 })).rejects.toBe(
      error
    );
    expect(fn).toHaveBeenCalledTimes(4);
  });

  it("defaults to three attempts", async () => {
    const { withRetry } = await freshModule();
    const fn = vi.fn().mockRejectedValue(new Error("boom"));

    await expect(withRetry(fn, { baseDelayMs: 0 })).rejects.toThrow("boom");
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it("stops immediately when the error is not retryable", async () => {
    const { withRetry } = await freshModule();
    const fn = vi.fn().mockRejectedValue(new Error("400 bad request"));

    await expect(
      withRetry(fn, { baseDelayMs: 0, isRetryable: () => false })
    ).rejects.toThrow("400 bad request");
    expect(fn).toHaveBeenCalledOnce();
  });

  it("passes the thrown error to isRetryable", async () => {
    const { withRetry } = await freshModule();
    const isRetryable = vi.fn().mockReturnValue(false);
    const error = new Error("nope");

    await expect(
      withRetry(vi.fn().mockRejectedValue(error), { isRetryable })
    ).rejects.toBe(error);
    expect(isRetryable).toHaveBeenCalledWith(error);
  });

  it("accepts a thenable that is not a real Promise", async () => {
    // Supabase's PostgREST query builders are thenables, not Promises —
    // the signature is PromiseLike<T> for exactly this reason.
    const { withRetry } = await freshModule();
    const thenable: PromiseLike<string> = {
      then: (onfulfilled, onrejected) =>
        Promise.resolve("from thenable").then(onfulfilled, onrejected),
    };

    await expect(withRetry(() => thenable)).resolves.toBe("from thenable");
  });

  it("backs off exponentially, capped at maxDelayMs", async () => {
    vi.useFakeTimers();
    const { withRetry } = await freshModule();
    const delays: number[] = [];
    const setTimeoutSpy = vi
      .spyOn(globalThis, "setTimeout")
      .mockImplementation(((cb: () => void, ms?: number) => {
        delays.push(ms ?? 0);
        cb();
        return 0 as unknown as ReturnType<typeof setTimeout>;
      }) as typeof setTimeout);

    await expect(
      withRetry(vi.fn().mockRejectedValue(new Error("boom")), {
        attempts: 5,
        baseDelayMs: 1000,
        maxDelayMs: 3000,
      })
    ).rejects.toThrow("boom");

    setTimeoutSpy.mockRestore();
    // base * 2**attempt = 1000, 2000, 4000→capped 3000, 3000 — each then
    // halved by the pinned Math.random() of 0.5.
    expect(delays).toEqual([500, 1000, 1500, 1500]);
  });
});

describe("withTimeout", () => {
  it("resolves when the work finishes in time", async () => {
    const { withTimeout } = await freshModule();
    await expect(
      withTimeout(() => Promise.resolve("done"), 1000, "work")
    ).resolves.toBe("done");
  });

  it("rejects with a labelled message when it does not", async () => {
    vi.useFakeTimers();
    const { withTimeout } = await freshModule();

    const pending = withTimeout(
      () => new Promise(() => {}),
      5000,
      "auth.getUser"
    );
    const assertion = expect(pending).rejects.toThrow(
      "auth.getUser timed out after 5000ms"
    );
    await vi.advanceTimersByTimeAsync(5000);
    await assertion;
  });

  it("propagates the original rejection rather than a timeout", async () => {
    const { withTimeout } = await freshModule();
    await expect(
      withTimeout(() => Promise.reject(new Error("db down")), 1000, "query")
    ).rejects.toThrow("db down");
  });

  it("clears its timer on the success path", async () => {
    // A leaked timer keeps a serverless function alive past its response.
    vi.useFakeTimers();
    const { withTimeout } = await freshModule();
    const clearSpy = vi.spyOn(globalThis, "clearTimeout");

    await withTimeout(() => Promise.resolve("done"), 5000, "work");

    expect(clearSpy).toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });

  it("clears its timer on the failure path too", async () => {
    vi.useFakeTimers();
    const { withTimeout } = await freshModule();

    await expect(
      withTimeout(() => Promise.reject(new Error("boom")), 5000, "work")
    ).rejects.toThrow("boom");

    expect(vi.getTimerCount()).toBe(0);
  });

  it("does not cancel the underlying work — documented behaviour", async () => {
    // Not every dependency exposes an abort signal, so the timeout only
    // stops the caller waiting. Asserted so nobody "fixes" it into a
    // breaking change for callers relying on the write completing.
    vi.useFakeTimers();
    const { withTimeout } = await freshModule();
    let settled = false;
    const work = new Promise((resolve) =>
      setTimeout(() => {
        settled = true;
        resolve("late");
      }, 10_000)
    );

    const pending = withTimeout(() => work, 5000, "work");
    const assertion = expect(pending).rejects.toThrow(/timed out/);
    await vi.advanceTimersByTimeAsync(5000);
    await assertion;
    expect(settled).toBe(false);

    await vi.advanceTimersByTimeAsync(5000);
    expect(settled).toBe(true);
  });
});

describe("circuit breaker", () => {
  it("stays closed while calls succeed", async () => {
    const { circuitBreakers, withCircuitBreaker } = await freshModule();

    await expect(
      withCircuitBreaker("db", () => Promise.resolve("ok"))
    ).resolves.toBe("ok");
    expect(circuitBreakers.status("db")).toBe("closed");
    expect(circuitBreakers.isOpen("db")).toBe(false);
  });

  it("opens after three consecutive failures", async () => {
    const { circuitBreakers, withCircuitBreaker } = await freshModule();
    const failing = () => Promise.reject(new Error("down"));

    for (let i = 0; i < 3; i++) {
      await expect(withCircuitBreaker("db", failing)).rejects.toThrow("down");
    }

    expect(circuitBreakers.status("db")).toBe("open");
    expect(circuitBreakers.isOpen("db")).toBe(true);
  });

  it("short-circuits without calling through once open", async () => {
    const { withCircuitBreaker, CircuitOpenError } = await freshModule();
    const failing = vi.fn().mockRejectedValue(new Error("down"));

    for (let i = 0; i < 3; i++) {
      await expect(withCircuitBreaker("db", failing)).rejects.toThrow("down");
    }
    failing.mockClear();

    await expect(withCircuitBreaker("db", failing)).rejects.toThrow(
      CircuitOpenError
    );
    expect(failing).not.toHaveBeenCalled();
  });

  it("keeps breakers independent per key", async () => {
    const { circuitBreakers, withCircuitBreaker } = await freshModule();
    const failing = () => Promise.reject(new Error("down"));

    for (let i = 0; i < 3; i++) {
      await expect(withCircuitBreaker("db", failing)).rejects.toThrow();
    }

    expect(circuitBreakers.status("db")).toBe("open");
    expect(circuitBreakers.status("ai")).toBe("closed");
  });

  it("a success resets the failure count", async () => {
    const { circuitBreakers, withCircuitBreaker } = await freshModule();
    const failing = () => Promise.reject(new Error("down"));

    await expect(withCircuitBreaker("db", failing)).rejects.toThrow();
    await expect(withCircuitBreaker("db", failing)).rejects.toThrow();
    await withCircuitBreaker("db", () => Promise.resolve("ok"));
    await expect(withCircuitBreaker("db", failing)).rejects.toThrow();

    expect(circuitBreakers.status("db")).toBe("closed");
  });

  it("half-opens after the reset window and closes on a successful probe", async () => {
    vi.useFakeTimers();
    const { circuitBreakers, withCircuitBreaker } = await freshModule();
    const failing = () => Promise.reject(new Error("down"));

    for (let i = 0; i < 3; i++) {
      await expect(withCircuitBreaker("db", failing)).rejects.toThrow();
    }
    expect(circuitBreakers.isOpen("db")).toBe(true);

    vi.advanceTimersByTime(30_000);

    expect(circuitBreakers.isOpen("db")).toBe(false);
    expect(circuitBreakers.status("db")).toBe("half-open");

    await withCircuitBreaker("db", () => Promise.resolve("ok"));
    expect(circuitBreakers.status("db")).toBe("closed");
  });

  it("stays open until the full reset window has elapsed", async () => {
    vi.useFakeTimers();
    const { circuitBreakers, withCircuitBreaker } = await freshModule();
    const failing = () => Promise.reject(new Error("down"));

    for (let i = 0; i < 3; i++) {
      await expect(withCircuitBreaker("db", failing)).rejects.toThrow();
    }

    vi.advanceTimersByTime(29_999);
    expect(circuitBreakers.isOpen("db")).toBe(true);
  });

  it("re-opens immediately when the half-open probe fails", async () => {
    // failureCount is not reset on the half-open transition, so the next
    // failure takes it from 3 to 4 and trips the threshold again.
    vi.useFakeTimers();
    const { circuitBreakers, withCircuitBreaker } = await freshModule();
    const failing = () => Promise.reject(new Error("down"));

    for (let i = 0; i < 3; i++) {
      await expect(withCircuitBreaker("db", failing)).rejects.toThrow();
    }
    vi.advanceTimersByTime(30_000);
    expect(circuitBreakers.isOpen("db")).toBe(false);

    await expect(withCircuitBreaker("db", failing)).rejects.toThrow("down");
    expect(circuitBreakers.status("db")).toBe("open");
    expect(circuitBreakers.isOpen("db")).toBe(true);
  });

  it("names the dependency in the CircuitOpenError", async () => {
    const { withCircuitBreaker } = await freshModule();
    const failing = () => Promise.reject(new Error("down"));

    for (let i = 0; i < 3; i++) {
      await expect(withCircuitBreaker("supabase", failing)).rejects.toThrow();
    }

    await expect(withCircuitBreaker("supabase", failing)).rejects.toThrow(
      /Circuit breaker open for "supabase"/
    );
  });
});
