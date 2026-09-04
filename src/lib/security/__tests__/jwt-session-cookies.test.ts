import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  buildPlatformSessionCookieValue,
  parsePlatformSessionCookieValue,
  passwordHashFingerprint,
} from "@/lib/platform/session";
import {
  isJwtIssuedBeforeRevocation,
  parseJwtIssuedAtSeconds,
} from "@/lib/security/jwt-claims";
import { sessionFingerprint, hashRefreshToken } from "@/lib/customer/sessions";
import { ADMIN_COOKIE, PLATFORM_USER_COOKIE } from "@/lib/admin/config";
import {
  authSessionCookieOptions,
  clearAuthSessionCookieOptions,
} from "@/lib/security/session-cookie-options";

const originalAdminSecret = process.env.ADMIN_SECRET;

afterEach(() => {
  if (originalAdminSecret === undefined) delete process.env.ADMIN_SECRET;
  else process.env.ADMIN_SECRET = originalAdminSecret;
});

function fakeJwt(payload: Record<string, unknown>): string {
  const header = Buffer.from(JSON.stringify({ alg: "none", typ: "JWT" })).toString(
    "base64url"
  );
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${header}.${body}.sig`;
}

describe("JWT validation / credential revocation", () => {
  it("parses iat from compact JWTs and ignores garbage", () => {
    expect(parseJwtIssuedAtSeconds(fakeJwt({ iat: 1_700_000_000 }))).toBe(
      1_700_000_000
    );
    expect(parseJwtIssuedAtSeconds("not-a-jwt")).toBeNull();
    expect(parseJwtIssuedAtSeconds(fakeJwt({ sub: "x" }))).toBeNull();
  });

  it("treats tokens issued before credentials_revoked_at as revoked", () => {
    const revokedAt = "2026-01-15T12:00:00.000Z";
    const revokedMs = Date.parse(revokedAt);
    expect(
      isJwtIssuedBeforeRevocation(Math.floor(revokedMs / 1000) - 60, revokedAt)
    ).toBe(true);
    expect(
      isJwtIssuedBeforeRevocation(Math.floor(revokedMs / 1000) + 60, revokedAt)
    ).toBe(false);
    expect(isJwtIssuedBeforeRevocation(null, revokedAt)).toBe(false);
    expect(isJwtIssuedBeforeRevocation(1_700_000_000, null)).toBe(false);
  });
});

describe("Session signing, fixation, and cookie flags", () => {
  it("uses distinct cookie names for owner vs platform sessions", () => {
    expect(ADMIN_COOKIE).toBe("nm_admin_session");
    expect(PLATFORM_USER_COOKIE).toBe("tg_platform_session");
    expect(ADMIN_COOKIE).not.toBe(PLATFORM_USER_COOKIE);
  });

  it("sets httpOnly + SameSite=lax and secure only in production", () => {
    expect(authSessionCookieOptions(3600, "production")).toEqual({
      httpOnly: true,
      sameSite: "lax",
      secure: true,
      path: "/",
      maxAge: 3600,
    });
    expect(authSessionCookieOptions(3600, "development").secure).toBe(false);
    expect(clearAuthSessionCookieOptions()).toEqual({
      httpOnly: true,
      path: "/",
      maxAge: 0,
    });
  });

  it("rejects tampered or expired HMAC platform sessions", async () => {
    process.env.ADMIN_SECRET = "test-only-secret-with-sufficient-entropy";
    const cookie = await buildPlatformSessionCookieValue(
      "user-1",
      "staff",
      "hash-a"
    );
    await expect(parsePlatformSessionCookieValue(cookie)).resolves.toMatchObject({
      uid: "user-1",
      role: "staff",
    });

    const [payload, sig] = cookie.split(".");
    await expect(
      parsePlatformSessionCookieValue(`${payload}.${sig.slice(0, -2)}aa`)
    ).resolves.toBeNull();

    // Role escalation in payload without valid signature
    const evilPayload = Buffer.from(
      JSON.stringify({
        uid: "user-1",
        role: "owner",
        exp: Math.floor(Date.now() / 1000) + 3600,
        pwd: "deadbeef",
      })
    ).toString("base64url");
    await expect(
      parsePlatformSessionCookieValue(`${evilPayload}.${sig}`)
    ).resolves.toBeNull();
  });

  it("fails closed without ADMIN_SECRET (no unsigned sessions)", async () => {
    delete process.env.ADMIN_SECRET;
    await expect(
      buildPlatformSessionCookieValue("u", "staff", "h")
    ).rejects.toThrow(/ADMIN_SECRET/);
    await expect(parsePlatformSessionCookieValue("a.b")).resolves.toBeNull();
  });

  it("binds sessions to password fingerprint (session fixation / password change)", async () => {
    process.env.ADMIN_SECRET = "test-only-secret-with-sufficient-entropy";
    const fpA = await passwordHashFingerprint("password-hash-a");
    const fpB = await passwordHashFingerprint("password-hash-b");
    expect(fpA).not.toBe(fpB);

    const cookie = await buildPlatformSessionCookieValue(
      "user-1",
      "manager",
      "password-hash-a"
    );
    const parsed = await parsePlatformSessionCookieValue(cookie);
    expect(parsed?.pwd).toBe(fpA);
    expect(parsed?.pwd).not.toBe(fpB);
  });

  it("mints server-signed session cookies (client cannot supply the session id)", async () => {
    process.env.ADMIN_SECRET = "test-only-secret-with-sufficient-entropy";
    const cookie = await buildPlatformSessionCookieValue("u1", "staff", "h1");
    expect(cookie.split(".")).toHaveLength(2);
    // Attacker-chosen legacy "session id.token" shape is not accepted as a signed session
    await expect(
      parsePlatformSessionCookieValue("attacker-chosen-id.deadbeef")
    ).resolves.toBeNull();
  });

  it("hashes session fingerprints and refresh tokens (no raw secrets stored)", () => {
    const fp = sessionFingerprint({
      userAgent: "Mozilla/5.0",
      ip: "1.2.3.4",
    });
    expect(fp).toHaveLength(32);
    expect(fp).not.toContain("Mozilla");
    expect(hashRefreshToken("refresh-token-value")).toHaveLength(64);
    expect(hashRefreshToken("refresh-token-value")).not.toBe("refresh-token-value");
  });
});
