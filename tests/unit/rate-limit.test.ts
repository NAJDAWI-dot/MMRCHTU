import { describe, expect, it } from "vitest";
import { clientKey, createRateLimiter } from "@/lib/rate-limit";

/** A clock the test drives by hand, so no test waits out a real window. */
function fakeClock(start = 1_000_000) {
  let t = start;
  return { now: () => t, advance: (ms: number) => (t += ms) };
}

describe("createRateLimiter", () => {
  it("allows requests up to the limit and refuses the next one", () => {
    const clock = fakeClock();
    const limiter = createRateLimiter({ limit: 3, windowMs: 60_000, now: clock.now });

    expect(limiter.check("a").allowed).toBe(true);
    expect(limiter.check("a").allowed).toBe(true);
    expect(limiter.check("a").allowed).toBe(true);
    expect(limiter.check("a").allowed).toBe(false);
  });

  it("counts down the remaining allowance", () => {
    const clock = fakeClock();
    const limiter = createRateLimiter({ limit: 3, windowMs: 60_000, now: clock.now });

    expect(limiter.check("a").remaining).toBe(2);
    expect(limiter.check("a").remaining).toBe(1);
    expect(limiter.check("a").remaining).toBe(0);
  });

  it("keeps callers separate", () => {
    const clock = fakeClock();
    const limiter = createRateLimiter({ limit: 1, windowMs: 60_000, now: clock.now });

    expect(limiter.check("a").allowed).toBe(true);
    expect(limiter.check("b").allowed).toBe(true);
    expect(limiter.check("a").allowed).toBe(false);
  });

  it("lets a caller back in once the window has passed", () => {
    const clock = fakeClock();
    const limiter = createRateLimiter({ limit: 2, windowMs: 60_000, now: clock.now });

    limiter.check("a");
    limiter.check("a");
    expect(limiter.check("a").allowed).toBe(false);

    clock.advance(60_001);
    expect(limiter.check("a").allowed).toBe(true);
  });

  /**
   * The reason this is a sliding window and not a fixed bucket: a fixed bucket
   * resets wholesale, letting a caller spend a full allowance either side of
   * the boundary — twice the limit in an instant.
   */
  it("slides, so an old request expires without freeing the whole allowance", () => {
    const clock = fakeClock();
    const limiter = createRateLimiter({ limit: 2, windowMs: 60_000, now: clock.now });

    limiter.check("a"); // t = 0
    clock.advance(30_000);
    limiter.check("a"); // t = 30s
    expect(limiter.check("a").allowed).toBe(false);

    // Only the first stamp has aged out here, so exactly one slot opens.
    clock.advance(30_001); // t = 60.001s
    expect(limiter.check("a").allowed).toBe(true);
    expect(limiter.check("a").allowed).toBe(false);
  });

  it("reports how long to wait, counted from the oldest request", () => {
    const clock = fakeClock();
    const limiter = createRateLimiter({ limit: 1, windowMs: 60_000, now: clock.now });

    limiter.check("a");
    clock.advance(20_000);
    expect(limiter.check("a").retryAfterMs).toBe(40_000);
  });

  it("does not grow without bound when every caller is new", () => {
    const clock = fakeClock();
    const limiter = createRateLimiter({ limit: 5, windowMs: 60_000, now: clock.now, maxKeys: 10 });

    for (let i = 0; i < 500; i++) limiter.check(`caller-${i}`);
    expect(limiter.size()).toBeLessThanOrEqual(10);
  });

  it("can be cleared", () => {
    const limiter = createRateLimiter({ limit: 1, windowMs: 60_000 });
    limiter.check("a");
    expect(limiter.check("a").allowed).toBe(false);
    limiter.reset();
    expect(limiter.check("a").allowed).toBe(true);
  });
});

describe("forget", () => {
  it("clears one key's history so it starts fresh", () => {
    // The login path calls this on a successful sign-in: proving you know the
    // password should not leave you closer to being locked out.
    const clock = fakeClock();
    const limiter = createRateLimiter({ limit: 2, windowMs: 60_000, now: clock.now });

    limiter.check("a");
    limiter.check("a");
    expect(limiter.check("a").allowed).toBe(false);

    limiter.forget("a");
    expect(limiter.check("a").allowed).toBe(true);
  });

  it("leaves every other key alone", () => {
    const clock = fakeClock();
    const limiter = createRateLimiter({ limit: 1, windowMs: 60_000, now: clock.now });

    limiter.check("a");
    limiter.check("b");
    limiter.forget("a");

    expect(limiter.check("a").allowed).toBe(true);
    expect(limiter.check("b").allowed).toBe(false);
  });

  it("is harmless for a key that was never seen", () => {
    const limiter = createRateLimiter({ limit: 1, windowMs: 60_000 });
    expect(() => limiter.forget("never-used")).not.toThrow();
    expect(limiter.size()).toBe(0);
  });
});

describe("clientKey", () => {
  it("takes the original client from a proxy chain", () => {
    const headers = new Headers({ "x-forwarded-for": "203.0.113.5, 70.41.3.18, 150.172.238.178" });
    expect(clientKey(headers)).toBe("203.0.113.5");
  });

  it("trims whitespace around the address", () => {
    expect(clientKey(new Headers({ "x-forwarded-for": "  203.0.113.5  " }))).toBe("203.0.113.5");
  });

  it("falls back to x-real-ip", () => {
    expect(clientKey(new Headers({ "x-real-ip": "198.51.100.9" }))).toBe("198.51.100.9");
  });

  /**
   * Grouped rather than exempt: an address we cannot read must not become a
   * way to bypass the limit entirely.
   */
  it("groups requests with no usable address instead of waving them through", () => {
    expect(clientKey(new Headers())).toBe("unknown");
    expect(clientKey(new Headers({ "x-forwarded-for": "" }))).toBe("unknown");
    expect(clientKey(new Headers({ "x-forwarded-for": "   " }))).toBe("unknown");
  });
});
