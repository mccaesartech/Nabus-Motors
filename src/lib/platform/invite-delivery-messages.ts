/**
 * Owner-facing invite delivery copy. Raw provider payloads belong in
 * Sentry / provider_error / notification_log — never echoed here.
 * `emailHint` is the only exception: it is already rewritten for admins.
 */

export type InviteDeliveryFailureInput = {
  emailSent: boolean;
  /** True when SMS/WhatsApp notify attempted and failed (not skipped). */
  notifyFailed?: boolean;
  /**
   * Safe, actionable rewrite from describeResendFailure (domain not verified,
   * wrong Resend team key, etc.). Shown after the short failure sentence.
   */
  emailHint?: string | null;
};

/** Short red-banner sentence when email and/or SMS delivery failed. */
export function ownerInviteDeliveryError(
  input: InviteDeliveryFailureInput
): string | null {
  const emailFailed = !input.emailSent;
  const smsFailed = Boolean(input.notifyFailed);
  let base: string | null = null;
  if (emailFailed && smsFailed) base = "The email and SMS could not be sent.";
  else if (emailFailed) base = "The email could not be sent.";
  else if (smsFailed) base = "The SMS could not be sent.";
  if (!base) return null;

  const hint = input.emailHint?.trim();
  if (emailFailed && hint) return `${base} ${hint}`;
  return base;
}