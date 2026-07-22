import { afterEach, describe, expect, it } from "vitest";
import {
  buildPlatformSessionCookieValue,
  parsePlatformSessionCookieValue,
} from "@/lib/platform/session";
import { mediaBytesMatchMime } from "@/lib/security/media-signature";
import {
  quotePostgrestFilterValue,
  userOrEmailFilter,
} from "@/lib/security/postgrest-filter";
import {
  consumeRateLimit,
  resetRateLimitsForTests,
} from "@/lib/security/rate-limit";
import { summarizeRecordForLog } from "@/lib/security/safe-logging";

const originalAdminSecret = process.env.ADMIN_SECRET;

afterEach(() => {
  resetRateLimitsForTests();
  if (originalAdminSecret === undefined) {
    delete process.env.ADMIN_SECRET;
  } else {
    process.env.ADMIN_SECRET = originalAdminSecret;
  }
});

describe("platform session signing", () => {
  it("fails closed when ADMIN_SECRET is absent", async () => {
    delete process.env.ADMIN_SECRET;

    await expect(
      buildPlatformSessionCookieValue("user-1", "staff", "password-hash")
    ).rejects.toThrow("ADMIN_SECRET");
    await expect(parsePlatformSessionCookieValue("payload.signature")).resolves.toBeNull();
  });

  it("accepts an intact HMAC session and rejects tampering", async () => {
    process.env.ADMIN_SECRET = "test-only-secret-with-sufficient-entropy";
    const cookie = await buildPlatformSessionCookieValue(
      "user-1",
      "manager",
      "password-hash"
    );

    await expect(parsePlatformSessionCookieValue(cookie)).resolves.toMatchObject({
      uid: "user-1",
      role: "manager",
    });

    const [payload, signature] = cookie.split(".");
    const tamperedPayload = `${payload.slice(0, -1)}${payload.endsWith("a") ? "b" : "a"}`;
    await expect(
      parsePlatformSessionCookieValue(`${tamperedPayload}.${signature}`)
    ).resolves.toBeNull();
  });
});

describe("in-process rate limiting", () => {
  it("blocks attempts beyond the configured window limit", () => {
    const options = { limit: 2, windowMs: 60_000, now: 1_000 };

    expect(consumeRateLimit("login", "client", options).allowed).toBe(true);
    expect(consumeRateLimit("login", "client", options).allowed).toBe(true);
    const blocked = consumeRateLimit("login", "client", options);
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfterSeconds).toBe(60);
  });
});

describe("PostgREST filter encoding", () => {
  it("quotes delimiters and escaped characters as data", () => {
    expect(quotePostgrestFilterValue('a,b"c\\d')).toBe('"a,b\\"c\\\\d"');
    expect(userOrEmailFilter("user-1", "a,b@example.com")).toBe(
      'user_id.eq."user-1",email.ilike."a,b@example.com"'
    );
  });
});

describe("media signature validation", () => {
  it("accepts matching signatures and rejects extension-only spoofing", () => {
    expect(
      mediaBytesMatchMime(
        new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
        "image/png"
      )
    ).toBe(true);
    expect(
      mediaBytesMatchMime(new TextEncoder().encode("<script>alert(1)</script>"), "image/png")
    ).toBe(false);
    expect(
      mediaBytesMatchMime(
        new Uint8Array([0, 0, 0, 24, 0x66, 0x74, 0x79, 0x70]),
        "video/mp4"
      )
    ).toBe(true);
  });
});

describe("safe operational logging", () => {
  it("reports payload shape without serializing sensitive values", () => {
    const secretValue = "private-person@example.com";
    const summary = summarizeRecordForLog({
      email: secretValue,
      phone: "+233000000000",
      message: "private message",
      status: "pending",
      total_usd: 100,
    });

    expect(summary).toEqual({
      fieldCount: 5,
      fields: ["status", "total_usd"],
      sensitiveFieldsOmitted: ["email", "message", "phone"],
    });
    expect(JSON.stringify(summary)).not.toContain(secretValue);
  });
});
