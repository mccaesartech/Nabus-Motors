/** Platform password policy — safe for client + server (no Node crypto). */

export const PLATFORM_PASSWORD_MIN_LENGTH = 10;

export type PasswordPolicyResult =
  | { ok: true }
  | { ok: false; message: string };

/**
 * Complexity rules for platform passwords.
 * Length matches Account security UI (`minLength={10}`).
 */
export function validatePlatformPasswordPolicy(password: string): PasswordPolicyResult {
  if (typeof password !== "string" || !password) {
    return { ok: false, message: "Password is required." };
  }
  if (password.length < PLATFORM_PASSWORD_MIN_LENGTH) {
    return {
      ok: false,
      message: `Password must be at least ${PLATFORM_PASSWORD_MIN_LENGTH} characters.`,
    };
  }
  if (!/[A-Z]/.test(password)) {
    return { ok: false, message: "Password must include at least one uppercase letter." };
  }
  if (!/[a-z]/.test(password)) {
    return { ok: false, message: "Password must include at least one lowercase letter." };
  }
  if (!/[0-9]/.test(password)) {
    return { ok: false, message: "Password must include at least one number." };
  }
  return { ok: true };
}
