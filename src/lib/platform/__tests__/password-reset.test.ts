import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  computePlatformPasswordResetExpiresAt,
  isPlatformPasswordResetExpired,
  PLATFORM_PASSWORD_RESET_TTL_MS,
  buildPlatformPasswordResetUrl,
  buildPlatformForgotPasswordUrl,
} from "@/lib/platform/password-reset-url";
import { validatePlatformPasswordPolicy } from "@/lib/platform/password-policy";
import { buildTeamPasswordResetMessage } from "@/lib/notifications/platform-team-whatsapp";

describe("platform password reset helpers", () => {
  it("computes a 1-hour expiry", () => {
    const now = Date.parse("2026-08-04T12:00:00.000Z");
    const expiresAt = computePlatformPasswordResetExpiresAt(now);
    expect(Date.parse(expiresAt) - now).toBe(PLATFORM_PASSWORD_RESET_TTL_MS);
    expect(isPlatformPasswordResetExpired(expiresAt, now + PLATFORM_PASSWORD_RESET_TTL_MS + 1)).toBe(
      true
    );
    expect(isPlatformPasswordResetExpired(expiresAt, now)).toBe(false);
  });

  it("builds public reset and forgot URLs", () => {
    const reset = buildPlatformPasswordResetUrl("abc123token", "https://www.truegoshengh.com");
    expect(reset).toBe(
      "https://www.truegoshengh.com/admin/reset-password?token=abc123token"
    );
    expect(buildPlatformForgotPasswordUrl("https://www.truegoshengh.com")).toBe(
      "https://www.truegoshengh.com/admin/forgot-password"
    );
  });

  it("builds SMS copy with reset URL and no password", () => {
    const text = buildTeamPasswordResetMessage({
      name: "Ama",
      resetUrl: "https://www.truegoshengh.com/admin/reset-password?token=x",
      expiryLabel: "1 hour",
    });
    expect(text).toContain("Ama");
    expect(text).toContain("reset-password?token=x");
    expect(text).toContain("1 hour");
    expect(text.toLowerCase()).not.toMatch(/temporary password|password:/);
  });
});

describe("platform password policy", () => {
  it("requires length, upper, lower, and number", () => {
    expect(validatePlatformPasswordPolicy("short").ok).toBe(false);
    expect(validatePlatformPasswordPolicy("alllowercase1").ok).toBe(false);
    expect(validatePlatformPasswordPolicy("ALLUPPERCASE1").ok).toBe(false);
    expect(validatePlatformPasswordPolicy("NoNumberHere").ok).toBe(false);
    expect(validatePlatformPasswordPolicy("ValidPass1").ok).toBe(true);
  });
});
