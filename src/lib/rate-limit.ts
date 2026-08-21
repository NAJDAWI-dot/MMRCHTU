/**
 * A sliding-window rate limiter for the public write endpoints.
 *
 * `/api/register` and `/api/game/scores` accept POSTs from anyone with no
 * throttle at all: registration is spammable, and the leaderboard is one loop
 * away from being filled with junk.
 *
 * ## What this does and does not protect
 *
 * The counters live in the process's memory. On Vercel each serverless instance
 * has its own, so a determined attacker spread across instances gets a multiple
 * of the limit rather than the limit. That is a real weakness and the reason
 * this is deliberately not described as abuse *prevention* — it is what stops
 * one script in a loop, which is the realistic threat to a student competition
 * site, without adding a Redis dependency and an account to manage.
 *
 * If it ever needs to be exact, the interface below is the one a shared store
 * would implement; only `check` would change.
 */

export interface RateLimitResult {
  allowed: boolean;
  /** Requests still permitted in the current window. */
  remaining: number;
  /** How long until the caller may retry. Zero while allowed. */
  retryAfterMs: number;
}

export interface RateLimiterOptions {
  /** Requests permitted per window. */
  limit: number;
  windowMs: number;
  /** Injectable so the tests do not have to wait out a real window. */
  now?: () => number;
  /**
   * Cap on tracked keys, so a flood of unique addresses cannot grow the map
   * without bound. On overflow the oldest key is dropped — worst case an
   * attacker resets their own counter, which is no worse than not tracking it.
   */
  maxKeys?: number;
}

export interface RateLimiter {
  check(key: string): RateLimitResult;
  /** Testing and teardown: forget everything currently tracked. */
  reset(): void;
  /** Number of keys currently held, for assertions about memory growth. */
  size(): number;
}

export function createRateLimiter({
  limit,
  windowMs,
  now = Date.now,
  maxKeys = 10_000,
}: RateLimiterOptions): RateLimiter {
  // Insertion-ordered, which is what makes evicting the oldest key cheap.
  const hits = new Map<string, number[]>();

  return {
    check(key: string): RateLimitResult {
      const t = now();
      const cutoff = t - windowMs;

      // Dropping expired stamps on read is what makes this a sliding window
      // rather than a fixed bucket that lets through 2x at a boundary.
      const recent = (hits.get(key) ?? []).filter((stamp) => stamp > cutoff);

      if (recent.length >= limit) {
        hits.set(key, recent);
        // The oldest stamp is the one whose expiry frees a slot.
        const retryAfterMs = Math.max(0, recent[0]! + windowMs - t);
        return { allowed: false, remaining: 0, retryAfterMs };
      }

      recent.push(t);
      hits.set(key, recent);

      if (hits.size > maxKeys) {
        const oldest = hits.keys().next();
        if (!oldest.done) hits.delete(oldest.value);
      }

      return { allowed: true, remaining: limit - recent.length, retryAfterMs: 0 };
    },
    reset() {
      hits.clear();
    },
    size() {
      return hits.size;
    },
  };
}

/**
 * Best-effort client address.
 *
 * `x-forwarded-for` is a client-controllable header that only becomes
 * trustworthy once a proxy has rewritten it; behind Vercel it has. The first
 * entry is the original client, the rest are proxies. Falls back to a shared
 * constant so a request with no usable address is still limited as a group
 * rather than waved through.
 */
export function clientKey(headers: Headers): string {
  const forwarded = headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  return headers.get("x-real-ip")?.trim() || "unknown";
}
