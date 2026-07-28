import { DISPOSABLE_EMAIL_DOMAINS } from "@/lib/email/disposable-domains";

/**
 * Practical signup email checks (format + disposable domains + optional MX).
 *
 * Limits: we do NOT SMTP-probe mailboxes. That is unreliable (greylisting,
 * catch-all domains, blocked outbound port 25) and must not be claimed as
 * "mailbox exists" proof. A domain with MX can still have fake local-parts.
 */

export type EmailValidationCode =
  | "ok"
  | "invalid_format"
  | "disposable"
  | "no_mx";

export type EmailValidationResult = {
  ok: boolean;
  code: EmailValidationCode;
  message: string;
  /** Normalized email when format is valid enough to normalize. */
  normalized: string | null;
  domain: string | null;
};

export const EMAIL_VALIDATION_MESSAGES = {
  invalid_format: "Enter a valid email address.",
  disposable: "Disposable email addresses aren't allowed.",
  no_mx: "This email domain looks invalid.",
  ok: "Email looks valid.",
} as const;

/** RFC-inspired practical format check (not a full RFC 5322 parser). */
const EMAIL_FORMAT_RE =
  /^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$/i;

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function extractEmailDomain(email: string): string | null {
  const normalized = normalizeEmail(email);
  const at = normalized.lastIndexOf("@");
  if (at <= 0 || at === normalized.length - 1) return null;
  return normalized.slice(at + 1);
}

export function isValidEmailFormat(email: string): boolean {
  const normalized = normalizeEmail(email);
  if (!normalized || normalized.length > 254) return false;
  if (!EMAIL_FORMAT_RE.test(normalized)) return false;
  const [local, domain] = normalized.split("@");
  if (!local || !domain) return false;
  if (local.length > 64) return false;
  if (local.startsWith(".") || local.endsWith(".") || local.includes("..")) {
    return false;
  }
  if (domain.startsWith("-") || domain.endsWith("-") || domain.includes("..")) {
    return false;
  }
  // Require a real TLD (at least 2 chars) — blocks "user@localhost" style.
  const labels = domain.split(".");
  const tld = labels[labels.length - 1];
  if (!tld || tld.length < 2) return false;
  return true;
}

export function isDisposableEmailDomain(domain: string): boolean {
  const normalized = domain.trim().toLowerCase();
  if (!normalized) return false;
  if (DISPOSABLE_EMAIL_DOMAINS.has(normalized)) return true;
  // Match subdomains of known disposable hosts (e.g. foo.mailinator.com).
  for (const blocked of DISPOSABLE_EMAIL_DOMAINS) {
    if (normalized.endsWith(`.${blocked}`)) return true;
  }
  return false;
}

function result(
  code: EmailValidationCode,
  normalized: string | null,
  domain: string | null
): EmailValidationResult {
  return {
    ok: code === "ok",
    code,
    message: EMAIL_VALIDATION_MESSAGES[code],
    normalized,
    domain,
  };
}

/**
 * Sync checks safe for browser + server: format + disposable domain blocklist.
 * Does not perform DNS/MX lookups.
 */
export function validateEmailLocal(email: string): EmailValidationResult {
  const normalized = normalizeEmail(email);
  if (!isValidEmailFormat(normalized)) {
    return result("invalid_format", null, null);
  }
  const domain = extractEmailDomain(normalized);
  if (!domain) {
    return result("invalid_format", null, null);
  }
  if (isDisposableEmailDomain(domain)) {
    return result("disposable", normalized, domain);
  }
  return result("ok", normalized, domain);
}
