import { toWhatsAppE164 } from "@/lib/notifications/phone";

export type ChannelDeliveryStatus =
  | "sent"
  | "failed"
  | "deferred"
  | "skipped"
  | "not_attempted";

/** Serializable notification result returned by admin APIs. */
export type CustomerNotificationPayload = {
  whatsappSent: boolean;
  emailSent: boolean;
  whatsappDeferred: boolean;
  saveReferenceOnScreen: boolean;
  channels: string[];
  whatsappStatus: ChannelDeliveryStatus;
  emailStatus: ChannelDeliveryStatus;
  whatsappReason?: string;
  emailReason?: string;
  phone?: string | null;
};

export type NotificationFeedbackVariant = "success" | "warning" | "neutral";

export type NotificationFeedback = {
  message: string;
  variant: NotificationFeedbackVariant;
};

/** Mask phone for admin display, e.g. +23324***4567 */
export function maskPhoneForDisplay(phone: string | null | undefined): string | null {
  const e164 = toWhatsAppE164(phone?.trim() ?? "");
  if (!e164) return null;
  const digits = e164.replace(/\D/g, "");
  if (digits.length <= 6) return e164;
  const visibleStart = e164.slice(0, Math.min(6, e164.length));
  const visibleEnd = digits.slice(-4);
  return `${visibleStart}***${visibleEnd}`;
}

/** Strip sensitive tokens from provider error messages before showing in UI. */
export function sanitizeNotificationReason(reason: string | undefined): string | undefined {
  if (!reason) return undefined;
  let sanitized = reason
    .replace(/Bearer\s+[A-Za-z0-9._-]+/gi, "Bearer [redacted]")
    .replace(/Authorization:\s*Basic\s+[A-Za-z0-9+/=]+/gi, "Authorization: [redacted]")
    .replace(/AC[a-f0-9]{32}/gi, "[account-sid]")
    .replace(/sk_[a-z0-9]+/gi, "[api-key]")
    .replace(/TWILIO_[A-Z_]+/g, "[env-var]")
    .replace(/WHATSAPP_[A-Z_]+/g, "[env-var]")
    .trim();

  if (sanitized.includes("WhatsApp API not configured")) {
    return "WhatsApp API not configured";
  }
  if (/Twilio error/i.test(sanitized)) {
    return "WhatsApp provider error — check Twilio configuration";
  }
  if (/Meta WhatsApp error/i.test(sanitized)) {
    return "WhatsApp provider error — check Meta configuration";
  }
  if (sanitized.length > 120) {
    sanitized = `${sanitized.slice(0, 117)}…`;
  }
  return sanitized;
}

function describeWhatsApp(result: CustomerNotificationPayload): string | null {
  const masked = maskPhoneForDisplay(result.phone);
  switch (result.whatsappStatus) {
    case "sent":
      return masked ? `WhatsApp sent to ${masked}` : "WhatsApp sent";
    case "deferred":
      return "WhatsApp not sent (API not configured)";
    case "failed":
      return result.whatsappReason
        ? `WhatsApp failed: ${result.whatsappReason}`
        : "WhatsApp failed";
    case "skipped":
      return result.whatsappReason ?? "WhatsApp not sent (no phone on file)";
    default:
      return null;
  }
}

function describeEmail(
  result: CustomerNotificationPayload,
  recipientEmail?: string
): string | null {
  switch (result.emailStatus) {
    case "sent":
      return recipientEmail ? `Email sent to ${recipientEmail}` : "Email sent";
    case "failed":
      return result.emailReason ? `Email failed: ${result.emailReason}` : "Email failed";
    case "skipped":
      return result.emailReason ?? "Email not sent (no email on file)";
    default:
      return null;
  }
}

/** Build admin-facing toast/banner text from a notification payload. */
export function formatCustomerNotificationFeedback(
  result: CustomerNotificationPayload | null | undefined,
  options?: {
    /** Prefix when the underlying action succeeded, e.g. "Saved" or "Shipment updated" */
    savedPrefix?: string;
    /** When no notification was attempted (dedup / no contact) */
    notAttemptedReason?: string;
    /** Recipient email for password-reset style messages */
    recipientEmail?: string;
  }
): NotificationFeedback {
  const prefix = options?.savedPrefix ?? "Saved";

  if (!result) {
    if (options?.notAttemptedReason) {
      return {
        message: `${prefix}. ${options.notAttemptedReason}`,
        variant: "neutral",
      };
    }
    return { message: prefix, variant: "success" };
  }

  const parts: string[] = [];
  const wa = describeWhatsApp(result);
  const email = describeEmail(result, options?.recipientEmail);
  if (wa) parts.push(wa);
  if (email) parts.push(email);

  if (parts.length === 0) {
    return { message: prefix, variant: "success" };
  }

  const anySent = result.whatsappSent || result.emailSent;
  const anyFailed =
    result.whatsappStatus === "failed" ||
    result.emailStatus === "failed" ||
    (result.whatsappStatus === "deferred" && !result.emailSent);

  const variant: NotificationFeedbackVariant = anySent
    ? anyFailed
      ? "warning"
      : "success"
    : anyFailed
      ? "warning"
      : "neutral";

  return {
    message: `${prefix}. ${parts.join(". ")}.`,
    variant,
  };
}

/** Customer-facing confirmation text after public form submissions (pre-order, freight, etc.). */
export function formatPublicCustomerNotificationFeedback(
  result: CustomerNotificationPayload | null | undefined
): NotificationFeedback {
  if (!result) {
    return { message: "", variant: "neutral" };
  }

  if (result.whatsappSent) {
    return {
      message: "We sent a confirmation to your WhatsApp.",
      variant: "success",
    };
  }

  if (result.emailSent) {
    const waSkipped =
      result.whatsappStatus === "skipped" || result.whatsappStatus === "not_attempted";
    if (waSkipped) {
      return {
        message: "We sent a confirmation to your email.",
        variant: "success",
      };
    }
    return {
      message:
        "We sent a confirmation to your email. WhatsApp could not be delivered automatically — our team will follow up if needed.",
      variant: "warning",
    };
  }

  if (result.whatsappStatus === "deferred" || result.whatsappStatus === "failed") {
    return {
      message:
        "We saved your request but could not send WhatsApp or email automatically. Our team will contact you shortly.",
      variant: "warning",
    };
  }

  if (result.whatsappStatus === "skipped") {
    const optedOut = result.whatsappReason?.includes("opted out");
    const noPhone = result.whatsappReason?.includes("no phone");
    if (optedOut && result.emailStatus === "not_attempted") {
      return {
        message: "Our team will contact you by email or phone.",
        variant: "neutral",
      };
    }
    if (noPhone) {
      return {
        message: "Add a phone number to receive WhatsApp updates. Our team will contact you by email.",
        variant: "neutral",
      };
    }
  }

  if (result.saveReferenceOnScreen) {
    return {
      message: "Save your reference above — our team will contact you shortly.",
      variant: "neutral",
    };
  }

  return { message: "", variant: "neutral" };
}
