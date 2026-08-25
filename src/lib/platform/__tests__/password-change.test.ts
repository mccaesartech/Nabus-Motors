import { describe, expect, it } from "vitest";
import { hashPassword, verifyPassword } from "@/lib/platform/password";
import {
  prepareAdminSetPassword,
  prepareSelfServicePasswordChange,
  validatePlatformPasswordPolicy,
} from "@/lib/platform/password-change";

const STRONG = "CorrectHorse9";
const STRONG_OTHER = "DifferentHorse9";

describe("validatePlatformPasswordPolicy", () => {
  it("rejects short / incomplete passwords", () => {
    expect(validatePlatformPasswordPolicy("short").ok).toBe(false);
    expect(validatePlatformPasswordPolicy("nouppercase1").ok).toBe(false);
    expect(validatePlatformPasswordPolicy("NOLOWERCASE1").ok).toBe(false);
    expect(validatePlatformPasswordPolicy("NoNumberHere").ok).toBe(false);
  });

  it("accepts a qualifying password", () => {
    expect(validatePlatformPasswordPolicy(STRONG).ok).toBe(true);
  });
});

describe("prepareSelfServicePasswordChange", () => {
  it("fails with 401 when current password is wrong", async () => {
    const stored = await hashPassword(STRONG);
    const result = await prepareSelfServicePasswordChange({
      currentPassword: "WrongPassword9",
      newPassword: STRONG_OTHER,
      storedHash: stored,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(401);
      expect(result.message).toMatch(/incorrect/i);
    }
  });

  it("fails when new password equals current (after verify)", async () => {
    const stored = await hashPassword(STRONG);
    const result = await prepareSelfServicePasswordChange({
      currentPassword: STRONG,
      newPassword: STRONG,
      storedHash: stored,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(400);
      expect(result.message).toMatch(/different/i);
    }
  });

  it("fails when new password fails policy even if current is correct", async () => {
    const stored = await hashPassword(STRONG);
    const result = await prepareSelfServicePasswordChange({
      currentPassword: STRONG,
      newPassword: "weak",
      storedHash: stored,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(400);
    }
  });

  it("succeeds and returns a hash that verifies the new password only", async () => {
    const stored = await hashPassword(STRONG);
    const result = await prepareSelfServicePasswordChange({
      currentPassword: STRONG,
      newPassword: STRONG_OTHER,
      storedHash: stored,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(await verifyPassword(STRONG_OTHER, result.passwordHash)).toBe(true);
    expect(await verifyPassword(STRONG, result.passwordHash)).toBe(false);
    expect(result.passwordHash).not.toBe(stored);
  });

  it("rejects missing stored hash without claiming success", async () => {
    const result = await prepareSelfServicePasswordChange({
      currentPassword: STRONG,
      newPassword: STRONG_OTHER,
      storedHash: null,
    });
    expect(result.ok).toBe(false);
  });
});

describe("prepareAdminSetPassword", () => {
  it("hashes a valid admin-set password", async () => {
    const result = await prepareAdminSetPassword(STRONG);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(await verifyPassword(STRONG, result.passwordHash)).toBe(true);
  });

  it("rejects weak admin-set passwords", async () => {
    const result = await prepareAdminSetPassword("temp");
    expect(result.ok).toBe(false);
  });
});