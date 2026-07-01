/** Map Supabase Auth errors to customer-friendly login messages. */
export function customerLoginErrorMessage(message: string): string {
  const normalized = message.toLowerCase();

  if (
    normalized.includes("invalid login credentials") ||
    normalized.includes("invalid email or password")
  ) {
    return "Incorrect email or password. You must register first to create your private account.";
  }

  if (normalized.includes("email not confirmed")) {
    return "Please confirm your email before signing in. Check your inbox for the confirmation link.";
  }

  if (normalized.includes("too many requests")) {
    return "Too many sign-in attempts. Please wait a moment and try again.";
  }

  if (
    normalized.includes("over_email_send_rate_limit") ||
    normalized.includes("email rate limit")
  ) {
    return "Too many account emails were sent recently. Please wait a few minutes and try again, or contact us via WhatsApp.";
  }

  return message;
}
