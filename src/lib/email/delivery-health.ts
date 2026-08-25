import "server-only";
import { getPlatformEmailConfig, readResendApiKey } from "@/lib/email/platform-invite";
import { parseResendFromAddress } from "@/lib/email/resend";
import {
  RESEND_DOMAIN_SETUP_URL,
  RESEND_FROM_ADDRESS_EXAMPLE,
} from "@/lib/email/resend-constants";

export { RESEND_DOMAIN_SETUP_URL } from "@/lib/email/resend-constants";

function normalizeFrom(value: string | undefined): string {
  return value?.trim().replace(/^["']|["']$/g, "") ?? "";
}

export function getResendFromAddress(): string {
  return normalizeFrom(process.env.RESEND_FROM_EMAIL);
}

export type EmailDeliveryHealth = {
  resendConfigured: boolean;
  fromAddress: string;
  fromDomain: string | null;
  isResendSandbox: boolean;
  setupGuideUrl: string;
  warning: string | null;
};

export function getEmailDeliveryHealth(): EmailDeliveryHealth {
  const config = getPlatformEmailConfig();
  const fromAddress = getResendFromAddress();
  const parsed = parseResendFromAddress(fromAddress);
  const fromDomain = parsed?.domain ?? null;
  // resend.dev is Resend's shared testing sender: it only reaches the account owner.
  const isResendSandbox = fromDomain === "resend.dev";

  let warning: string | null = null;
  if (!config.hasApiKey) {
    warning =
      "RESEND_API_KEY is not set — customer emails use Supabase Auth SMTP only when configured.";
  } else if (!config.hasFromAddress) {
    warning = "RESEND_FROM_EMAIL is not set — Resend email delivery is unavailable.";
  } else if (!parsed) {
    warning =
      'RESEND_FROM_EMAIL is not a valid sender — use "noreply@yourdomain.com" or "Name <noreply@yourdomain.com>".';
  } else if (isResendSandbox) {
    warning = `RESEND_FROM_EMAIL uses Resend's testing sender, so only the Resend account owner receives mail. Verify your domain at ${RESEND_DOMAIN_SETUP_URL} and set RESEND_FROM_EMAIL=${RESEND_FROM_ADDRESS_EXAMPLE}.`;
  }

  return {
    resendConfigured: Boolean(readResendApiKey()),
    fromAddress,
    fromDomain,
    isResendSandbox,
    setupGuideUrl: RESEND_DOMAIN_SETUP_URL,
    warning,
  };
}
