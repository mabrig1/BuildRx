/**
 * In-memory sliding-window rate limiter.
 *
 * Suitable for a single server instance (or per-instance limiting on
 * serverless with warm containers). For strict multi-instance limits,
 * swap the store for Redis/Upstash — the call sites won't change.
 */

interface WindowEntry {
  timestamps: number[];
}

const store = new Map<string, WindowEntry>();

// Periodically drop stale keys so the map doesn't grow unbounded.
const CLEANUP_INTERVAL_MS = 5 * 60 * 1000;
let lastCleanup = Date.now();

export interface RateLimitResult {
  success: boolean;
  limit: number;
  remaining: number;
  /** Epoch ms when the oldest counted request leaves the window. */
  reset: number;
}

export function rateLimit(
  key: string,
  { limit, windowMs }: { limit: number; windowMs: number }
): RateLimitResult {
  const now = Date.now();

  if (now - lastCleanup > CLEANUP_INTERVAL_MS) {
    lastCleanup = now;
    for (const [k, entry] of store) {
      if (
        entry.timestamps.length === 0 ||
        entry.timestamps[entry.timestamps.length - 1] < now - windowMs
      ) {
        store.delete(k);
      }
    }
  }

  const entry = store.get(key) ?? { timestamps: [] };
  entry.timestamps = entry.timestamps.filter((t) => t > now - windowMs);

  const success = entry.timestamps.length < limit;
  if (success) {
    entry.timestamps.push(now);
  }
  store.set(key, entry);

  return {
    success,
    limit,
    remaining: Math.max(0, limit - entry.timestamps.length),
    reset: (entry.timestamps[0] ?? now) + windowMs,
  };
}

export function rateLimitHeaders(result: RateLimitResult): HeadersInit {
  return {
    "X-RateLimit-Limit": String(result.limit),
    "X-RateLimit-Remaining": String(result.remaining),
    "X-RateLimit-Reset": String(Math.ceil(result.reset / 1000)),
    ...(result.success
      ? {}
      : {
          "Retry-After": String(
            Math.max(1, Math.ceil((result.reset - Date.now()) / 1000))
          ),
        }),
  };
}
