/** Map Supabase Auth errors to customer-friendly messages. Never expose vendor text. */

const FALLBACK =
  "We could not sign you in. Check your details and try again, or contact us if the problem continues.";

export function customerLoginErrorMessage(message: string): string {
  const normalized = (message || "").toLowerCase();

  if (
    normalized.includes("invalid login credentials") ||
    normalized.includes("invalid email or password") ||
    normalized.includes("invalid_credentials")
  ) {
    return "Incorrect email or password. You must register first to create your private account.";
  }

  if (normalized.includes("email not confirmed")) {
    return "Please confirm your email before signing in. Check your inbox for the confirmation link.";
  }

  if (
    normalized.includes("too many requests") ||
    normalized.includes("rate limit")
  ) {
    return "Too many sign-in attempts. Please wait a moment and try again.";
  }

  if (
    normalized.includes("over_email_send_rate_limit") ||
    normalized.includes("email rate limit")
  ) {
    return "Too many account emails were sent recently. Please wait a few minutes and try again, or contact us via WhatsApp.";
  }

  if (normalized.includes("user banned") || normalized.includes("disabled")) {
    return "This account is not available. Please contact support for help.";
  }

  if (normalized.includes("network") || normalized.includes("fetch")) {
    return "We could not reach the sign-in service. Check your connection and try again.";
  }

  // Never return raw Supabase / provider strings to the UI.
  return FALLBACK;
}

export function customerAuthErrorMessage(
  message: string,
  fallback = FALLBACK
): string {
  const mapped = customerLoginErrorMessage(message);
  if (mapped === FALLBACK) return fallback;
  return mapped;
}
