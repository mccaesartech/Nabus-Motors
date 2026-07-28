import "server-only";

import { promises as dns } from "node:dns";
import {
  type EmailValidationResult,
  validateEmailLocal,
} from "@/lib/email/validate-email";

export type ValidateEmailForSignupOptions = {
  /** When true (default), reject domains with no MX records. */
  checkMx?: boolean;
};

/**
 * Full signup validation: format + disposable list + optional MX lookup.
 *
 * MX absence usually means the domain cannot receive mail. This still cannot
 * prove a specific mailbox exists — we intentionally skip SMTP RCPT probing.
 */
export async function validateEmailForSignup(
  email: string,
  options: ValidateEmailForSignupOptions = {}
): Promise<EmailValidationResult> {
  const local = validateEmailLocal(email);
  if (!local.ok || !local.domain) return local;

  if (options.checkMx === false) return local;

  const hasMx = await domainHasMx(local.domain);
  if (!hasMx) {
    return {
      ok: false,
      code: "no_mx",
      message: "This email domain looks invalid.",
      normalized: local.normalized,
      domain: local.domain,
    };
  }

  return local;
}

export async function domainHasMx(domain: string): Promise<boolean> {
  const normalized = domain.trim().toLowerCase();
  if (!normalized) return false;

  try {
    const records = await dns.resolveMx(normalized);
    return Array.isArray(records) && records.length > 0;
  } catch (error) {
    const code =
      error && typeof error === "object" && "code" in error
        ? String((error as { code?: unknown }).code ?? "")
        : "";
    // ENODATA / ENOTFOUND = no MX; other errors treated as fail-closed for signup.
    if (code === "ENODATA" || code === "ENOTFOUND" || code === "ETIMEOUT") {
      return false;
    }
    // Network/DNS resolver issues: fail closed for signup protection.
    return false;
  }
}
