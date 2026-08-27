import "server-only";

import { Resend } from "resend";
import { enqueueAuditLog } from "@/lib/audit/write";

export type SendEmailInput = {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
};

export type SendEmailResult = {
  messageId: string;
};

/**
 * Carries Resend's verbatim rejection. Callers persist `message`, so it embeds
 * the provider code, HTTP status and the From address we actually used —
 * without those, a friendly hint can hide a completely different failure.
 */
export class ResendSendError extends Error {
  readonly providerMessage: string;
  readonly providerCode: string | null;
  readonly statusCode: number | null;
  readonly fromAddress: string;
  readonly fromDomain: string;

  constructor(params: {
    providerMessage: string;
    providerCode?: string | null;
    statusCode?: number | null;
    from: ResendFromAddress;
  }) {
    const code = params.providerCode?.trim() || null;
    const status = params.statusCode ?? null;
    const label = [code, status ? `HTTP ${status}` : null].filter(Boolean).join(", ");
    super(
      `Resend rejected the send${label ? ` (${label})` : ""} from ${params.from.address}: ${params.providerMessage}`
    );
    this.name = "ResendSendError";
    this.providerMessage = params.providerMessage;
    this.providerCode = code;
    this.statusCode = status;
    this.fromAddress = params.from.address;
    this.fromDomain = params.from.domain;
  }
}

const EMAIL_ADDRESS_PATTERN = /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/;
const DISPLAY_NAME_PATTERN = /^(.*\S)\s*<([^\s<>]+@[^\s<>]+\.[^\s<>]+)>$/;

export type ResendFromAddress = {
  /** Value passed to Resend, display name included when configured. */
  header: string;
  /** Bare mailbox, e.g. noreply@truegoshengh.com. */
  address: string;
  /** Lower-cased domain that must be verified in Resend. */
  domain: string;
};

/**
 * Resend accepts both `noreply@example.com` and `Name <noreply@example.com>`.
 * Returns null when the value is absent or neither form parses.
 */
export function parseResendFromAddress(
  raw: string | undefined
): ResendFromAddress | null {
  const header = raw?.trim().replace(/^["']|["']$/g, "") ?? "";
  if (!header) return null;

  const withDisplayName = header.match(DISPLAY_NAME_PATTERN);
  const address = withDisplayName ? withDisplayName[2] : header;
  if (!EMAIL_ADDRESS_PATTERN.test(address)) return null;

  return {
    header,
    address,
    domain: address.slice(address.lastIndexOf("@") + 1).toLowerCase(),
  };
}

/**
 * Validate Resend's server-only environment contract.
 * Called by instrumentation at Node.js startup and again before each send.
 */
export function validateResendEnvironment(): ResendFromAddress {
  if (!process.env.RESEND_API_KEY?.trim()) {
    throw new Error("RESEND_API_KEY environment variable is missing.");
  }

  if (!process.env.RESEND_FROM_EMAIL?.trim()) {
    throw new Error("RESEND_FROM_EMAIL environment variable is missing.");
  }

  const from = parseResendFromAddress(process.env.RESEND_FROM_EMAIL);
  if (!from) {
    throw new Error(
      'RESEND_FROM_EMAIL must be "noreply@yourdomain.com" or "Name <noreply@yourdomain.com>".'
    );
  }

  return from;
}

export async function sendEmail({
  to,
  subject,
  html,
  text,
}: SendEmailInput): Promise<SendEmailResult> {
  const from = validateResendEnvironment();

  const recipients = Array.isArray(to) ? to : [to];
  const resend = new Resend(process.env.RESEND_API_KEY);

  console.info(
    [
      "Sender:",
      from.header,
      "Recipient:",
      recipients.join(", "),
      "Subject:",
      subject,
    ].join("\n")
  );

  const maxAttempts = 3;
  let lastFailure: {
    message?: string;
    name?: string;
    statusCode?: number | null;
  } | null = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const { data, error } = await resend.emails.send({
      from: from.header,
      to: recipients,
      subject,
      html,
      ...(text ? { text } : {}),
    });

    if (!error && data?.id) {
      enqueueAuditLog({
        action: "email_sent",
        success: true,
        targetType: "email",
        metadata: { subject, recipientCount: recipients.length, attempt },
      });
      return { messageId: data.id };
    }

    if (error) {
      lastFailure = error as {
        message?: string;
        name?: string;
        statusCode?: number | null;
      };
    } else {
      lastFailure = {
        message: "Resend accepted the request but returned no provider message ID.",
      };
    }

    const providerMessage = lastFailure.message?.trim() || "Resend failed to send email.";
    const transient = isTransientResendFailure({
      message: providerMessage,
      code: lastFailure.name ?? null,
      statusCode: lastFailure.statusCode ?? null,
    });

    if (!transient || attempt === maxAttempts) {
      break;
    }

    console.warn(
      JSON.stringify({
        event: "resend_send_retry",
        attempt,
        maxAttempts,
        providerMessage: providerMessage.slice(0, 200),
      })
    );
    await sleep(300 * attempt);
  }

  const failureMessage =
    lastFailure?.message?.trim() || "Resend failed to send email.";
  enqueueAuditLog({
    action: "email_failed",
    success: false,
    targetType: "email",
    errorMessage: failureMessage.slice(0, 500),
    metadata: { subject, recipientCount: recipients.length },
  });
  throw new ResendSendError({
    providerMessage: failureMessage,
    providerCode: lastFailure?.name ?? null,
    statusCode: lastFailure?.statusCode ?? null,
    from,
  });
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Network / provider blips that often succeed on a quick retry. */
function isTransientResendFailure(params: {
  message: string;
  code: string | null;
  statusCode: number | null;
}): boolean {
  const lower = params.message.toLowerCase();
  if (
    lower.includes("unable to fetch data") ||
    lower.includes("could not be resolved") ||
    lower.includes("timeout") ||
    lower.includes("timed out") ||
    lower.includes("econnreset") ||
    lower.includes("fetch failed") ||
    lower.includes("network") ||
    lower.includes("temporarily") ||
    lower.includes("try again")
  ) {
    return true;
  }
  if (params.code === "application_error" || params.code === "internal_server_error") {
    return true;
  }
  if (params.statusCode != null && params.statusCode >= 500) {
    return true;
  }
  return false;
}