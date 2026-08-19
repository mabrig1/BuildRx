/**
 * Generic retry-with-backoff and circuit-breaker primitives used by
 * health checks and auto-fix execution to talk to flaky external
 * dependencies (Supabase, AI providers, deploy providers) without
 * hammering them or hanging forever.
 */

export interface RetryOptions {
  attempts?: number;
  /** Base delay in ms; each retry doubles it (plus jitter). */
  baseDelayMs?: number;
  maxDelayMs?: number;
  /** Return false to stop retrying immediately (e.g. non-retryable errors). */
  isRetryable?: (error: unknown) => boolean;
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Exponential backoff with full jitter, capped at maxDelayMs.
 * Accepts anything awaitable (including Supabase's PostgREST query
 * builders, which are thenables but not literal Promise instances).
 */
export async function withRetry<T>(
  fn: () => PromiseLike<T>,
  options: RetryOptions = {}
): Promise<T> {
  const {
    attempts = 3,
    baseDelayMs = 250,
    maxDelayMs = 5000,
    isRetryable = () => true,
  } = options;

  let lastError: unknown;
  for (let attempt = 0; attempt < attempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      const isLastAttempt = attempt === attempts - 1;
      if (isLastAttempt || !isRetryable(error)) throw error;
      const backoff = Math.min(baseDelayMs * 2 ** attempt, maxDelayMs);
      await delay(Math.random() * backoff);
    }
  }
  throw lastError;
}

type BreakerState = "closed" | "open" | "half-open";

interface BreakerRecord {
  state: BreakerState;
  failureCount: number;
  openedAt: number;
}

/**
 * Per-process circuit breaker keyed by dependency name. Serverless
 * instances are short-lived, so this is a best-effort guard against a
 * single instance hammering an already-down dependency within one
 * invocation's lifetime — not a substitute for the dependency's own
 * rate limiting.
 */
class CircuitBreakerRegistry {
  private breakers = new Map<string, BreakerRecord>();

  constructor(
    private readonly failureThreshold = 3,
    private readonly resetAfterMs = 30_000
  ) {}

  private get(key: string): BreakerRecord {
    let record = this.breakers.get(key);
    if (!record) {
      record = { state: "closed", failureCount: 0, openedAt: 0 };
      this.breakers.set(key, record);
    }
    return record;
  }

  isOpen(key: string): boolean {
    const record = this.get(key);
    if (record.state !== "open") return false;
    if (Date.now() - record.openedAt >= this.resetAfterMs) {
      record.state = "half-open";
      return false;
    }
    return true;
  }

  recordSuccess(key: string): void {
    this.breakers.set(key, { state: "closed", failureCount: 0, openedAt: 0 });
  }

  recordFailure(key: string): void {
    const record = this.get(key);
    record.failureCount += 1;
    if (record.failureCount >= this.failureThreshold) {
      record.state = "open";
      record.openedAt = Date.now();
    }
  }

  status(key: string): BreakerState {
    return this.get(key).state;
  }
}

/**
 * Bounds an awaitable to `ms`, throwing a clear, labeled error instead of
 * letting the caller hang indefinitely. Does not cancel the underlying
 * operation (not every dependency exposes an abort signal) — it only
 * stops the caller from waiting on it forever, so a single stuck
 * dependency can't silently burn a serverless function's whole duration
 * budget with no diagnosable error.
 */
export async function withTimeout<T>(
  fn: () => PromiseLike<T>,
  ms: number,
  label: string
): Promise<T> {
  let timer: ReturnType<typeof setTimeout>;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(
      () => reject(new Error(`${label} timed out after ${ms}ms`)),
      ms
    );
  });
  try {
    return await Promise.race([Promise.resolve(fn()), timeout]);
  } finally {
    clearTimeout(timer!);
  }
}

export const circuitBreakers = new CircuitBreakerRegistry();

export class CircuitOpenError extends Error {
  constructor(key: string) {
    super(`Circuit breaker open for "${key}" — too many recent failures.`);
    this.name = "CircuitOpenError";
  }
}

/** Runs `fn` guarded by a named circuit breaker. */
export async function withCircuitBreaker<T>(
  key: string,
  fn: () => Promise<T>
): Promise<T> {
  if (circuitBreakers.isOpen(key)) {
    throw new CircuitOpenError(key);
  }
  try {
    const result = await fn();
    circuitBreakers.recordSuccess(key);
    return result;
  } catch (error) {
    circuitBreakers.recordFailure(key);
    throw error;
  }
}
