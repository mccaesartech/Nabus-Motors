export const RESEND_DOMAIN_SETUP_URL = "https://resend.com/domains";

/** Resend sandbox sender — only delivers to the Resend account owner's inbox. */
export function isResendSandboxFrom(from: string): boolean {
  return from.toLowerCase().includes("@resend.dev");
}

/** Human-readable hint for failed email rows in Platform → Emails. */
export function formatEmailFailureHint(detail: string | null): string | null {
  if (!detail) return null;
  const lower = detail.toLowerCase();

  if (lower.includes("@resend.dev") || lower.includes("sandbox")) {
    return "Resend sandbox — verify your domain at resend.com/domains and set RESEND_FROM_EMAIL to noreply@yourdomain.com in Vercel.";
  }
  if (lower.includes("domain") && lower.includes("verify")) {
    return "Resend domain not verified — add DNS records at resend.com/domains.";
  }
  if (lower.includes("supabase_auth") || lower.includes("rate limit")) {
    return "Supabase Auth email failed — configure SMTP under Supabase → Authentication → SMTP Settings.";
  }
  if (lower.includes("generateLink") || lower.includes("user not found")) {
    return "No auth account for this email — customer must sign up via a quote or pre-order first.";
  }
  if (lower.includes("resend error") || lower.includes("validation")) {
    return detail;
  }

  return detail;
}
