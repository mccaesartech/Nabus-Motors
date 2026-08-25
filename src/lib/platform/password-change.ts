import { hashPassword, verifyPassword } from "@/lib/platform/password";
import {
  PLATFORM_PASSWORD_MIN_LENGTH,
  validatePlatformPasswordPolicy,
  type PasswordPolicyResult,
} from "@/lib/platform/password-policy";

export {
  PLATFORM_PASSWORD_MIN_LENGTH,
  validatePlatformPasswordPolicy,
  type PasswordPolicyResult,
};

export type PasswordChangeFailure = {
  ok: false;
  status: 400 | 401;
  message: string;
};

export type PasswordChangeReady = {
  ok: true;
  /** Fresh scrypt hash ready to persist. */
  passwordHash: string;
};

/**
 * Self-service change: verify current against stored hash, reject reuse, enforce policy,
 * then hash the new password. Never returns ok without a fresh hash.
 */
export async function prepareSelfServicePasswordChange(params: {
  currentPassword: string;
  newPassword: string;
  storedHash: string | null | undefined;
}): Promise<PasswordChangeFailure | PasswordChangeReady> {
  const currentPassword =
    typeof params.currentPassword === "string" ? params.currentPassword : "";
  const newPassword = typeof params.newPassword === "string" ? params.newPassword : "";

  if (!currentPassword || !newPassword) {
    return {
      ok: false,
      status: 400,
      message: "Current and new password are required.",
    };
  }

  if (!params.storedHash) {
    return {
      ok: false,
      status: 400,
      message: "This account has no password set. Contact an owner.",
    };
  }

  const currentValid = await verifyPassword(currentPassword, params.storedHash);
  if (!currentValid) {
    return {
      ok: false,
      status: 401,
      message: "Current password is incorrect.",
    };
  }

  if (currentPassword === newPassword) {
    return {
      ok: false,
      status: 400,
      message: "New password must be different from your current password.",
    };
  }

  // Defense in depth: reject if new still verifies against the stored hash
  // (e.g. Unicode normalization edge cases that make string compare miss).
  const newMatchesStored = await verifyPassword(newPassword, params.storedHash);
  if (newMatchesStored) {
    return {
      ok: false,
      status: 400,
      message: "New password must be different from your current password.",
    };
  }

  const policy = validatePlatformPasswordPolicy(newPassword);
  if (!policy.ok) {
    return { ok: false, status: 400, message: policy.message };
  }

  const passwordHash = await hashPassword(newPassword);
  return { ok: true, passwordHash };
}

/**
 * Admin (or invite) set-password: no current-password check, but still policy + hash.
 */
export async function prepareAdminSetPassword(
  newPassword: string
): Promise<PasswordChangeFailure | PasswordChangeReady> {
  const password = typeof newPassword === "string" ? newPassword : "";
  const policy = validatePlatformPasswordPolicy(password);
  if (!policy.ok) {
    return { ok: false, status: 400, message: policy.message };
  }
  const passwordHash = await hashPassword(password);
  return { ok: true, passwordHash };
}
