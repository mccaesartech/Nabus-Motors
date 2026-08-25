import { afterEach, describe, expect, it } from "vitest";
import {
  consumeRateLimit,
  requestIp,
  resetRateLimitsForTests,
} from "@/lib/security/rate-limit";

afterEach(() => {
  resetRateLimitsForTests();
});

describe("Rate limiting", () => {
  it("allows traffic up to the limit then blocks", () => {
    const options = { limit: 3, windowMs: 60_000, now: 5_000 };
    expect(consumeRateLimit("login", "ip-1", options).allowed).toBe(true);
    expect(consumeRateLimit("login", "ip-1", options).allowed).toBe(true);
    expect(consumeRateLimit("login", "ip-1", options).allowed).toBe(true);
    const blocked = consumeRateLimit("login", "ip-1", options);
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfterSeconds).toBeGreaterThan(0);
    expect(blocked.remaining).toBe(0);
  });

  it("isolates namespaces and identifiers", () => {
    const options = { limit: 1, windowMs: 60_000, now: 1_000 };
    expect(consumeRateLimit("admin-login", "a", options).allowed).toBe(true);
    expect(consumeRateLimit("admin-login", "a", options).allowed).toBe(false);
    expect(consumeRateLimit("admin-login", "b", options).allowed).toBe(true);
    expect(consumeRateLimit("customer-login", "a", options).allowed).toBe(true);
  });

  it("resets after the window elapses", () => {
    expect(
      consumeRateLimit("x", "y", { limit: 1, windowMs: 1_000, now: 0 }).allowed
    ).toBe(true);
    expect(
      consumeRateLimit("x", "y", { limit: 1, windowMs: 1_000, now: 500 }).allowed
    ).toBe(false);
    expect(
      consumeRateLimit("x", "y", { limit: 1, windowMs: 1_000, now: 1_001 }).allowed
    ).toBe(true);
  });

  it("prefers the first x-forwarded-for hop as client IP", () => {
    const headers = new Headers({
      "x-forwarded-for": " 203.0.113.9 , 10.0.0.1",
      "x-real-ip": "10.0.0.1",
    });
    expect(requestIp(headers)).toBe("203.0.113.9");
  });
});
