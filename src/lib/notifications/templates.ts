import { getAutoSiteUrl, getPublicSiteUrl } from "@/lib/site-url";

export type CustomerNotifyTemplate =
  | "freight_quote_submitted"
  | "shipping_consultation_submitted"
  | "preorder_submitted"
  | "custom_request_submitted"
  | "quote_converted_tracking"
  | "shipment_status_update"
  | "appointment_confirmed"
  | "appointment_request_received"
  | "cart_order_confirmed"
  | "password_reset";

type TemplateContent = {
  subject: string;
  whatsapp: string;
  emailText: string;
};

function trackingUrl(): string {
  return `${getPublicSiteUrl()}/freight-forwarding/tracking`;
}

function accountUrl(): string {
  return `${getPublicSiteUrl()}/account`;
}

function forgotPasswordUrl(): string {
  return `${getAutoSiteUrl()}/forgot-password`;
}

function passwordResetSuffix(resetUrl: string): string {
  return ` Set your password anytime: ${resetUrl}. Forgot password? ${forgotPasswordUrl()}`;
}

export function buildCustomerMessage(
  template: CustomerNotifyTemplate,
  data: Record<string, string | undefined>
): TemplateContent {
  const name = data.customerName?.trim() || "there";
  const reference = data.referenceCode?.trim() || "";
  const trackingNumber = data.trackingNumber?.trim() || "";
  const vehicle = data.vehicleTitle?.trim() || "your vehicle";
  const registrationId = data.registrationId?.trim() || "";
  const statusNote = data.statusNote?.trim() || "";
  const statusLabel = data.statusLabel?.trim() || "";
  const appointmentDate = data.appointmentDate?.trim() || "";
  const branch = data.branch?.trim() || "";
  const passwordResetUrl = data.passwordResetUrl?.trim() || "";
  const resetSuffix = passwordResetUrl ? passwordResetSuffix(passwordResetUrl) : "";

  switch (template) {
    case "freight_quote_submitted":
      return {
        subject: `Your True Goshen quote reference — ${reference}`,
        whatsapp: `Thank you for choosing True Goshen! Your quote reference is ${reference}. Track at ${trackingUrl()}. We'll contact you shortly.${resetSuffix}`,
        emailText: `Hi ${name},\n\nThank you for choosing True Goshen Company Limited.\n\nYour quote reference is: ${reference}\nTrack your request: ${trackingUrl()}\n\nOur freight team will contact you within 1–2 business days.${passwordResetUrl ? `\n\nYour account is ready. Set your password anytime: ${passwordResetUrl}\nForgot password later? ${forgotPasswordUrl()}` : ""}\n\nTrue Goshen Company Limited`,
      };
    case "shipping_consultation_submitted":
      return {
        subject: `Your True Goshen consultation reference — ${reference}`,
        whatsapp: `Thank you for choosing True Goshen! Your quote reference is ${reference}. Track at ${trackingUrl()}. We'll contact you shortly to schedule your consultation.${resetSuffix}`,
        emailText: `Hi ${name},\n\nThank you for choosing True Goshen Company Limited.\n\nYour quote reference is: ${reference}\nTrack: ${trackingUrl()}\n\nOur freight team will reach out shortly to schedule your consultation.${passwordResetUrl ? `\n\nYour account is ready. Set your password anytime: ${passwordResetUrl}\nForgot password later? ${forgotPasswordUrl()}` : ""}\n\nTrue Goshen Company Limited`,
      };
    case "preorder_submitted": {
      const accountReadySuffix = passwordResetUrl
        ? ` Your account is ready. Track at ${accountUrl()}. Set your password: ${passwordResetUrl}`
        : registrationId
          ? `. Track at ${accountUrl()}`
          : "";
      return {
        subject: `Pre-order confirmation${registrationId ? ` — ${registrationId}` : ""}`,
        whatsapp: registrationId
          ? `True Goshen: Pre-order confirmed for ${vehicle}. Reference: ${registrationId}${accountReadySuffix}`
          : `True Goshen: Pre-order confirmed for ${vehicle}. Our team will contact you shortly.${resetSuffix}`,
        emailText: registrationId
          ? `Hi ${name},\n\nYour pre-order for ${vehicle} is confirmed.\n\nAccount reference: ${registrationId}\nTrack in your account: ${accountUrl()}${passwordResetUrl ? `\nSet your password anytime: ${passwordResetUrl}\nForgot password? ${forgotPasswordUrl()}` : ""}\n\nTrue Goshen`
          : `Hi ${name},\n\nYour pre-order for ${vehicle} is confirmed. Our team will contact you shortly.${passwordResetUrl ? `\n\nSet your password anytime: ${passwordResetUrl}` : ""}\n\nTrue Goshen`,
      };
    }
    case "custom_request_submitted": {
      const ref = reference || registrationId;
      const accountSuffix = passwordResetUrl
        ? `\n\nYour account is ready. Track requests at ${accountUrl()}\nSet your password: ${passwordResetUrl}`
        : `\n\nTrack your request in your account: ${accountUrl()}`;
      return {
        subject: `Custom vehicle request received${ref ? ` — ${ref}` : ""}`,
        whatsapp: ref
          ? `True Goshen: We received your custom vehicle request for ${vehicle}. Reference: ${ref}. Our team will review sourcing options and contact you.${passwordResetUrl ? ` Set password: ${passwordResetUrl}` : ""}`
          : `True Goshen: We received your custom vehicle request for ${vehicle}. Our team will contact you shortly.`,
        emailText: `Hi ${name},\n\nThank you for your custom vehicle request for ${vehicle}.${ref ? `\n\nReference: ${ref}` : ""}\n\nOur owners and managers will review whether we can source this vehicle and follow up with you.${accountSuffix}\n\nTrue Goshen Auto`,
      };
    }
    case "quote_converted_tracking":
      return {
        subject: `Shipment tracking ${trackingNumber}`,
        whatsapp: `True Goshen: Your shipment is live. Tracking: ${trackingNumber}. Track at ${trackingUrl()}`,
        emailText: `Hi ${name},\n\nYour freight quote has been converted to a shipment.\n\nTracking number: ${trackingNumber}\nTrack: ${trackingUrl()}\n\nTrue Goshen`,
      };
    case "shipment_status_update": {
      const statusPart = statusLabel ? ` is now ${statusLabel}` : "";
      const notePart =
        statusNote && statusNote !== statusLabel ? ` — ${statusNote}` : statusNote && !statusLabel ? ` — ${statusNote}` : "";
      return {
        subject: `Shipment update ${trackingNumber}`,
        whatsapp: `True Goshen: ${trackingNumber}${statusPart}${notePart}. Track at ${trackingUrl()}`,
        emailText: `Hi ${name},\n\nUpdate on shipment ${trackingNumber}${statusLabel ? ` — now ${statusLabel}` : ""}${statusNote ? `:\n${statusNote}` : "."}\n\nTrack: ${trackingUrl()}\n\nTrue Goshen`,
      };
    }
    case "appointment_confirmed":
      return {
        subject: "Appointment confirmed",
        whatsapp: `True Goshen: Your appointment${appointmentDate ? ` on ${appointmentDate}` : ""}${branch ? ` at ${branch}` : ""} is confirmed.`,
        emailText: `Hi ${name},\n\nYour appointment${appointmentDate ? ` on ${appointmentDate}` : ""}${branch ? ` at ${branch}` : ""} is confirmed.\n\nTrue Goshen`,
      };
    case "appointment_request_received": {
      const timePart = data.appointmentTime?.trim()
        ? ` at ${data.appointmentTime.trim()}`
        : "";
      return {
        subject: "Showroom visit request received",
        whatsapp: `True Goshen: We received your showroom visit request${appointmentDate ? ` for ${appointmentDate}${timePart}` : ""}${branch ? ` at ${branch}` : ""}. Our team will confirm shortly. Manage in your account: ${accountUrl()}`,
        emailText: `Hi ${name},\n\nWe received your request to visit our showroom${appointmentDate ? ` on ${appointmentDate}${timePart}` : ""}${branch ? ` at ${branch}` : ""}.\n\nOur team will confirm your appointment and help you view and pay for your vehicle.\n\nTrack status in your account: ${accountUrl()}\n\nTrue Goshen`,
      };
    }
    case "cart_order_confirmed": {
      const orderRef = data.orderRef?.trim() || reference || "";
      const total = data.orderTotal?.trim() || "";
      const refPart = orderRef ? ` (ref ${orderRef})` : "";
      const totalPart = total ? ` Total: ${total}.` : "";
      const accountPart = ` Track your order: ${accountUrl()}`;
      return {
        subject: `Your True Goshen order is confirmed${orderRef ? ` — ${orderRef}` : ""}`,
        whatsapp: `True Goshen: Your cart order${refPart} is confirmed.${totalPart}${accountPart} Book a showroom visit from your account.`,
        emailText: `Hi ${name},\n\nYour True Goshen cart order${refPart} is confirmed.${totalPart}\n\nView order history and book a showroom visit in your account:\n${accountUrl()}\n\nOur team will contact you shortly with next steps.\n\nTrue Goshen Company Limited`,
      };
    }
    case "password_reset": {
      const resetUrl = passwordResetUrl || forgotPasswordUrl();
      const refPart = reference ? ` Your reference: ${reference}.` : "";
      return {
        subject: "Reset your True Goshen password",
        whatsapp: `True Goshen: Reset your password here: ${resetUrl}.${refPart}`,
        emailText: `Hi ${name},\n\nReset your True Goshen password using this secure link:\n${resetUrl}${reference ? `\n\nYour reference: ${reference}` : ""}\n\nThis link expires soon. If you did not request this, you can ignore this email.\n\nTrue Goshen Company Limited`,
      };
    }
    default:
      return {
        subject: "True Goshen update",
        whatsapp: "True Goshen: Thank you for choosing True Goshen.",
        emailText: `Hi ${name},\n\nThank you for choosing True Goshen.\n`,
      };
  }
}
