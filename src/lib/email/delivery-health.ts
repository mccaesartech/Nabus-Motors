import "server-only";
import { getPlatformEmailConfig, readResendApiKey } from "@/lib/email/platform-invite";
import {
  isResendSandboxFrom,
  RESEND_DOMAIN_SETUP_URL,
} from "@/lib/email/resend-constants";

export { RESEND_DOMAIN_SETUP_URL } from "@/lib/email/resend-constants";

function normalizeFrom(value: string | undefined): string {
  return value?.trim().replace(/^["']|["']$/g, "") ?? "";
}

export function getResendFromAddress(): string {
  return (
    normalizeFrom(process.env.RESEND_FROM_EMAIL) ||
    normalizeFrom(process.env.FROM_EMAIL) ||
    "True Goshen <onboarding@resend.dev>"
  );
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
  const isResendSandbox = isResendSandboxFrom(fromAddress);
  const domainMatch = fromAddress.match(/@([a-z0-9.-]+)/i);
  const fromDomain = domainMatch?.[1] ?? null;

  let warning: string | null = null;
  if (!config.hasApiKey) {
    warning =
      "RESEND_API_KEY is not set — customer emails use Supabase Auth SMTP only when configured.";
  } else if (isResendSandbox) {
    warning =
      "RESEND_FROM_EMAIL uses @resend.dev (sandbox). Only the Resend account owner receives mail. Verify your domain at resend.com/domains and update RESEND_FROM_EMAIL in Vercel.";
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
