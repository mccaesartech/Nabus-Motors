export const RESEND_DOMAIN_SETUP_URL = "https://resend.com/domains";

/**
 * Admin-only check that reports which Resend domains the API key baked into the
 * *running* deployment can see. Vercel scopes and freezes env vars per
 * environment, so this is the only way to tell a stale or wrong-team key apart
 * from an unverified domain.
 */
export const RESEND_DIAGNOSTICS_PATH = "/api/admin/email-diagnostics";

export const RESEND_SENDING_DOMAIN = "truegoshengh.com";
export const RESEND_FROM_ADDRESS_EXAMPLE = `noreply@${RESEND_SENDING_DOMAIN}`;

/**
 * Resend has no verified domain for the From address, so it will only deliver
 * to the account owner's own inbox.
 */
const SANDBOX_RESTRICTION = /only send testing emails to your own email address/i;

/** Resend names the offending domain: "The example.com domain is not verified". */
const NAMED_UNVERIFIED_DOMAIN =
  /\b(?:the\s+)?([a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9-]+)*\.[a-z]{2,})\s+domain is not verified\b/i;

/**
 * The same rejection without a named domain. Deliberately phrase-anchored:
 * matching a bare "resend.com/domains" link or a loose "domain" + "not
 * verified" pair mislabels unrelated failures (and re-matches our own hint).
 */
const UNVERIFIED_DOMAIN_PHRASES = [
  /\bdomain is not verified\b/i,
  /\bdomain is not yet verified\b/i,
  /\bverify a domain at\b/i,
  /\byou can only send from verified domains\b/i,
];

export type ResendFailureContext = {
  /** Domain of the From address we actually sent with, when known. */
  fromDomain?: string | null;
  /** Full From mailbox we actually sent with, when known. */
  fromAddress?: string | null;
};

/**
 * Resend refuses to deliver to third parties until the From address sits on a
 * domain verified inside the account that owns the API key. Only claim this
 * when Resend genuinely says so — every other failure must reach the admin
 * verbatim.
 */
export function isResendDomainVerificationError(
  detail: string | null | undefined
): boolean {
  if (!detail) return false;
  return (
    SANDBOX_RESTRICTION.test(detail) ||
    NAMED_UNVERIFIED_DOMAIN.test(detail) ||
    UNVERIFIED_DOMAIN_PHRASES.some((pattern) => pattern.test(detail))
  );
}

/** The domain Resend itself named as unverified, when it named one. */
export function extractUnverifiedDomain(
  detail: string | null | undefined
): string | null {
  if (!detail) return null;
  const match = detail.match(NAMED_UNVERIFIED_DOMAIN);
  return match ? match[1].toLowerCase() : null;
}

/**
 * Turn a raw Resend rejection into an instruction an admin can act on.
 * Returns null when the failure is not a domain-verification problem.
 *
 * The domain is taken from Resend's own text (or the address we sent with)
 * rather than assumed, because "verify truegoshengh.com" is useless advice
 * when Resend actually rejected a different sender domain.
 */
export function describeResendFailure(
  detail: string | null | undefined,
  context: ResendFailureContext = {}
): string | null {
  if (!isResendDomainVerificationError(detail)) return null;

  const domain =
    extractUnverifiedDomain(detail) ??
    context.fromDomain?.trim().toLowerCase() ??
    RESEND_SENDING_DOMAIN;
  const sender = context.fromAddress?.trim() || `noreply@${domain}`;

  return [
    `Resend would not deliver from ${sender}: ${domain} is not verified in the Resend account that owns RESEND_API_KEY, so mail only reaches that account owner's own inbox.`,
    `If ${domain} already shows "Verified" at ${RESEND_DOMAIN_SETUP_URL}, then RESEND_API_KEY belongs to a different Resend account or team — create a new API key inside the account that owns the verified domain.`,
    `Otherwise verify ${domain} there, set RESEND_FROM_EMAIL=noreply@${domain} in Vercel (Production), and redeploy.`,
    "Until then, share the invite link manually.",
  ].join(" ");
}

/** Human-readable hint for failed email rows in Platform → Emails. */
export function formatEmailFailureHint(detail: string | null): string | null {
  if (!detail) return null;
  const lower = detail.toLowerCase();

  const domainHint = describeResendFailure(detail);
  if (domainHint) return domainHint;

  if (lower.includes("supabase_auth") || lower.includes("rate limit")) {
    return "Supabase Auth email failed — configure SMTP under Supabase → Authentication → SMTP Settings.";
  }
  if (lower.includes("generatelink") || lower.includes("user not found")) {
    return "No auth account for this email — customer must sign up via a quote or pre-order first.";
  }

  // Anything we do not recognise reaches the admin exactly as the provider sent it.
  return detail;
}
