import { getAutoSiteUrl, getPublicSiteUrl } from "@/lib/site-url";
import { CUSTOMER_FACING_COMPANY_NAME } from "@/lib/customer/public-branding";

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
  | "order_submitted"
  | "preorder_status_update"
  | "staff_message"
  | "password_reset"
  | "vehicle_available_locally"
  | "price_drop"
  | "account_deletion_scheduled"
  | "account_deletion_cancelled"
  | "account_deletion_completed"
  | "mfa_enabled"
  | "mfa_disabled"
  | "password_changed"
  | "login_new_device"
  | "login_alert"
  | "login_attempt_failed"
  | "account_lockout";

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

function vehicleRequestsAccountUrl(): string {
  return `${getPublicSiteUrl()}/account#vehicle-requests`;
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
        subject: `Your Nabus Motors quote reference — ${reference}`,
        whatsapp: `Thank you for choosing Nabus Motors! Your quote reference is ${reference}. Track at ${trackingUrl()}. We'll contact you shortly.${resetSuffix}`,
        emailText: `Hi ${name},\n\nThank you for choosing Nabus Motors and Trading.\n\nYour quote reference is: ${reference}\nTrack your request: ${trackingUrl()}\n\nOur freight team will contact you within 1–2 business days.${passwordResetUrl ? `\n\nYour account is ready. Set your password anytime: ${passwordResetUrl}\nForgot password later? ${forgotPasswordUrl()}` : ""}\n\nNabus Motors and Trading`,
      };
    case "shipping_consultation_submitted":
      return {
        subject: `Your Nabus Motors consultation reference — ${reference}`,
        whatsapp: `Thank you for choosing Nabus Motors! Your quote reference is ${reference}. Track at ${trackingUrl()}. We'll contact you shortly to schedule your consultation.${resetSuffix}`,
        emailText: `Hi ${name},\n\nThank you for choosing Nabus Motors and Trading.\n\nYour quote reference is: ${reference}\nTrack: ${trackingUrl()}\n\nOur freight team will reach out shortly to schedule your consultation.${passwordResetUrl ? `\n\nYour account is ready. Set your password anytime: ${passwordResetUrl}\nForgot password later? ${forgotPasswordUrl()}` : ""}\n\nNabus Motors and Trading`,
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
          ? `Nabus Motors: Pre-order confirmed for ${vehicle}. Reference: ${registrationId}${accountReadySuffix}`
          : `Nabus Motors: Pre-order confirmed for ${vehicle}. Our team will contact you shortly.${resetSuffix}`,
        emailText: registrationId
          ? `Hi ${name},\n\nYour pre-order for ${vehicle} is confirmed.\n\nAccount reference: ${registrationId}\nTrack in your account: ${accountUrl()}${passwordResetUrl ? `\nSet your password anytime: ${passwordResetUrl}\nForgot password? ${forgotPasswordUrl()}` : ""}\n\nNabus Motors`
          : `Hi ${name},\n\nYour pre-order for ${vehicle} is confirmed. Our team will contact you shortly.${passwordResetUrl ? `\n\nSet your password anytime: ${passwordResetUrl}` : ""}\n\nNabus Motors`,
      };
    }
    case "custom_request_submitted": {
      const ref = reference || registrationId;
      const trackUrl = vehicleRequestsAccountUrl();
      const accountSuffix = passwordResetUrl
        ? `\n\nYour account is ready. Track this request at ${trackUrl}\nSet your password: ${passwordResetUrl}`
        : `\n\nTrack your request anytime: ${trackUrl}`;
      return {
        subject: `Custom vehicle request received${ref ? ` — ${ref}` : ""}`,
        whatsapp: ref
          ? `Nabus Motors: We received your custom vehicle request for ${vehicle}. Reference: ${ref}. Track at ${trackUrl}.${passwordResetUrl ? ` Set password: ${passwordResetUrl}` : ""}`
          : `Nabus Motors: We received your custom vehicle request for ${vehicle}. Track at ${trackUrl}. Our team will contact you shortly.`,
        emailText: `Hi ${name},\n\nThank you for your custom vehicle request for ${vehicle}.${ref ? `\n\nReference: ${ref}` : ""}\n\nOur team at ${CUSTOMER_FACING_COMPANY_NAME} will review whether we can source this vehicle and follow up with you.${accountSuffix}\n\n${CUSTOMER_FACING_COMPANY_NAME}`,
      };
    }
    case "quote_converted_tracking":
      return {
        subject: `Shipment tracking ${trackingNumber}`,
        whatsapp: `Nabus Motors: Your shipment is live. Tracking: ${trackingNumber}. Track at ${trackingUrl()}`,
        emailText: `Hi ${name},\n\nYour freight quote has been converted to a shipment.\n\nTracking number: ${trackingNumber}\nTrack: ${trackingUrl()}\n\nNabus Motors`,
      };
    case "shipment_status_update": {
      const statusPart = statusLabel ? ` is now ${statusLabel}` : "";
      const notePart =
        statusNote && statusNote !== statusLabel ? ` — ${statusNote}` : statusNote && !statusLabel ? ` — ${statusNote}` : "";
      return {
        subject: `Shipment update ${trackingNumber}`,
        whatsapp: `Nabus Motors: ${trackingNumber}${statusPart}${notePart}. Track at ${trackingUrl()}`,
        emailText: `Hi ${name},\n\nUpdate on shipment ${trackingNumber}${statusLabel ? ` — now ${statusLabel}` : ""}${statusNote ? `:\n${statusNote}` : "."}\n\nTrack: ${trackingUrl()}\n\nNabus Motors`,
      };
    }
    case "appointment_confirmed":
      return {
        subject: "Appointment confirmed",
        whatsapp: `Nabus Motors: Your appointment${appointmentDate ? ` on ${appointmentDate}` : ""}${branch ? ` at ${branch}` : ""} is confirmed.`,
        emailText: `Hi ${name},\n\nYour appointment${appointmentDate ? ` on ${appointmentDate}` : ""}${branch ? ` at ${branch}` : ""} is confirmed.\n\nNabus Motors`,
      };
    case "appointment_request_received": {
      const timePart = data.appointmentTime?.trim()
        ? ` at ${data.appointmentTime.trim()}`
        : "";
      return {
        subject: "Showroom visit request received",
        whatsapp: `Nabus Motors: We received your showroom visit request${appointmentDate ? ` for ${appointmentDate}${timePart}` : ""}${branch ? ` at ${branch}` : ""}. Our team will confirm shortly. Manage in your account: ${accountUrl()}`,
        emailText: `Hi ${name},\n\nWe received your request to visit our showroom${appointmentDate ? ` on ${appointmentDate}${timePart}` : ""}${branch ? ` at ${branch}` : ""}.\n\nOur team will confirm your appointment and help you view and pay for your vehicle.\n\nTrack status in your account: ${accountUrl()}\n\nNabus Motors`,
      };
    }
    case "cart_order_confirmed": {
      const orderRef = data.orderRef?.trim() || reference || "";
      const total = data.orderTotal?.trim() || "";
      const refPart = orderRef ? ` (ref ${orderRef})` : "";
      const totalPart = total ? ` Total: ${total}.` : "";
      const accountPart = ` Track your order: ${accountUrl()}`;
      return {
        subject: `Your Nabus Motors order is confirmed${orderRef ? ` — ${orderRef}` : ""}`,
        whatsapp: `Nabus Motors: Your cart order${refPart} is confirmed.${totalPart}${accountPart} Book a showroom visit from your account.`,
        emailText: `Hi ${name},\n\nYour Nabus Motors cart order${refPart} is confirmed.${totalPart}\n\nView order history and book a showroom visit in your account:\n${accountUrl()}\n\nOur team will contact you shortly with next steps.\n\nNabus Motors and Trading`,
      };
    }
    case "order_submitted": {
      const itemCount = data.itemCount?.trim() || "1";
      return {
        subject: "Your Nabus Motors order was received",
        whatsapp: `Nabus Motors: We received your order (${itemCount} item(s)). Our team will confirm details shortly. Track: ${accountUrl()}`,
        emailText: `Hi ${name},\n\nWe received your order with ${itemCount} item(s). Our team will confirm pricing, availability, and next steps shortly.\n\nTrack your order: ${accountUrl()}\n\nNabus Motors and Trading`,
      };
    }
    case "preorder_status_update": {
      const title = data.updateTitle?.trim() || "Your pre-order";
      const status = data.statusLabel?.trim() || statusLabel || "updated";
      const trackUrl = data.isCustomRequest === "true" ? vehicleRequestsAccountUrl() : accountUrl();
      return {
        subject: `${title} — status update`,
        whatsapp: `Nabus Motors: ${title}: status is now ${status}. Track: ${trackUrl}`,
        emailText: `Hi ${name},\n\n${title}: your status is now ${status}.\n\nTrack in your account: ${trackUrl}\n\nNabus Motors`,
      };
    }
    case "staff_message": {
      const subject = data.messageSubject?.trim() || "your inquiry";
      const preview = data.messagePreview?.trim() || "You have a new message.";
      const company = CUSTOMER_FACING_COMPANY_NAME;
      return {
        subject: `New message from Nabus Motors: ${subject}`,
        whatsapp: `Nabus Motors: New reply about "${subject}": ${preview} View: ${accountUrl()}`,
        emailText: `Hi ${name},\n\n${company} sent you a message about "${subject}":\n\n${preview}\n\nView and reply in your account: ${accountUrl()}\n\n${company}`,
      };
    }
    case "password_reset": {
      const resetUrl = passwordResetUrl || forgotPasswordUrl();
      const refPart = reference ? ` Your reference: ${reference}.` : "";
      return {
        subject: "Reset your Nabus Motors password",
        whatsapp: `Nabus Motors: Reset your password here: ${resetUrl}.${refPart}`,
        emailText: `Hi ${name},\n\nReset your Nabus Motors password using this secure link:\n${resetUrl}${reference ? `\n\nYour reference: ${reference}` : ""}\n\nThis link expires soon. If you did not request this, you can ignore this email.\n\nNabus Motors and Trading`,
      };
    }
    case "vehicle_available_locally": {
      const vehicleUrl = data.vehicleUrl?.trim() || "";
      return {
        subject: `${vehicle} is now available in Ghana`,
        whatsapp: `Nabus Motors: The ${vehicle} you viewed is now available in Ghana — buy without shipping.${vehicleUrl ? ` View: ${vehicleUrl}` : ""}`,
        emailText: `Hi ${name},\n\nGood news — the ${vehicle} you viewed is now available in Ghana and can be purchased without shipping.\n\nView the vehicle:${vehicleUrl ? `\n${vehicleUrl}` : ""}\n\nNabus Motors`,
      };
    }
    case "price_drop": {
      const vehicleUrl = data.vehicleUrl?.trim() || "";
      const oldPrice = data.oldPrice?.trim() || "";
      const newPrice = data.newPrice?.trim() || "";
      const pricePart =
        oldPrice && newPrice
          ? ` Price dropped from $${oldPrice} to $${newPrice}.`
          : newPrice
            ? ` New price: $${newPrice}.`
            : "";
      return {
        subject: `Price drop: ${vehicle}`,
        whatsapp: `Nabus Motors: Price drop on ${vehicle}.${pricePart}${vehicleUrl ? ` View: ${vehicleUrl}` : ""}`,
        emailText: `Hi ${name},\n\nGood news — the price dropped on ${vehicle}.${pricePart}\n\nView the vehicle:${vehicleUrl ? `\n${vehicleUrl}` : ""}\n\nNabus Motors`,
      };
    }
    case "mfa_enabled":
      return {
        subject: "Authenticator enabled on your Nabus Motors account",
        whatsapp: `Nabus Motors: Two-factor authentication was turned on for your account. If this wasn't you, reset your password and contact support. ${accountUrl()}`,
        emailText: `Hi ${name},\n\nTwo-factor authentication (authenticator app) was turned on for your Nabus Motors account.\n\nIf you did not make this change, reset your password immediately and contact support.\n\nAccount security: ${accountUrl()}\n\nNabus Motors and Trading`,
      };
    case "mfa_disabled":
      return {
        subject: "Authenticator removed from your Nabus Motors account",
        whatsapp: `Nabus Motors: Two-factor authentication was turned off for your account. If this wasn't you, reset your password and contact support. ${accountUrl()}`,
        emailText: `Hi ${name},\n\nTwo-factor authentication was turned off for your Nabus Motors account.\n\nIf you did not make this change, reset your password immediately and contact support.\n\nAccount security: ${accountUrl()}\n\nNabus Motors and Trading`,
      };
    case "password_changed":
      return {
        subject: "Your Nabus Motors password was changed",
        whatsapp: `Nabus Motors: Your password was changed. If this wasn't you, reset it now: ${forgotPasswordUrl()}`,
        emailText: `Hi ${name},\n\nYour Nabus Motors password was changed successfully.\n\nIf you did not make this change, reset your password immediately:\n${forgotPasswordUrl()}\n\nThen review active sessions in your account: ${accountUrl()}\n\nNabus Motors and Trading`,
      };
    case "login_new_device": {
      const when = data.when?.trim() || "just now";
      const device = data.device?.trim() || "a new device";
      const ip = data.ip?.trim() || "";
      return {
        subject: "New device signed in to Nabus Motors",
        whatsapp: `Nabus Motors: New sign-in from ${device} (${when}). If this wasn't you, change your password: ${forgotPasswordUrl()}`,
        emailText: `Hi ${name},\n\nA new device signed in to your Nabus Motors account.\n\nWhen: ${when}\nDevice: ${device}${ip ? `\nIP: ${ip}` : ""}\n\nIf this was not you, change your password and review sessions:\n${forgotPasswordUrl()}\n${accountUrl()}\n\nNabus Motors and Trading`,
      };
    }
    case "login_alert": {
      const when = data.when?.trim() || "just now";
      const device = data.device?.trim() || "";
      const ip = data.ip?.trim() || "";
      return {
        subject: "New sign-in to your Nabus Motors account",
        whatsapp: `Nabus Motors: Someone signed in to your account at ${when}${device ? ` from ${device}` : ""}. If this wasn't you, reset your password: ${forgotPasswordUrl()}`,
        emailText: `Hi ${name},\n\nSomeone signed in to your Nabus Motors account.\n\nWhen: ${when}${device ? `\nDevice: ${device}` : ""}${ip ? `\nIP: ${ip}` : ""}\n\nIf this was not you, change your password and review sessions:\n${forgotPasswordUrl()}\n${accountUrl()}\n\nNabus Motors and Trading`,
      };
    }
    case "login_attempt_failed": {
      const when = data.when?.trim() || "just now";
      const device = data.device?.trim() || "an unknown device";
      const ip = data.ip?.trim() || "";
      return {
        subject: "Failed sign-in attempt on your Nabus Motors account",
        whatsapp: `Nabus Motors: A failed sign-in was attempted on your account from ${device} (${when}). If this wasn't you, reset your password: ${forgotPasswordUrl()}`,
        emailText: `Hi ${name},\n\nSomeone tried to sign in to your Nabus Motors account but did not enter the correct password.\n\nWhen: ${when}\nDevice: ${device}${ip ? `\nIP: ${ip}` : ""}\n\nIf this was not you, change your password immediately:\n${forgotPasswordUrl()}\n${accountUrl()}\n\nNabus Motors and Trading`,
      };
    }
    case "account_lockout":
      return {
        subject: "Nabus Motors account temporarily locked",
        whatsapp: `Nabus Motors: Your account was temporarily locked after too many failed sign-in attempts. Try again later, or reset your password: ${forgotPasswordUrl()}`,
        emailText: `Hi ${name},\n\nYour Nabus Motors account was temporarily locked after too many failed sign-in attempts.\n\nIf this was you, wait a short time and try again, or reset your password:\n${forgotPasswordUrl()}\n\nIf this was not you, reset your password and contact support.\n\nNabus Motors and Trading`,
      };
    case "account_deletion_scheduled": {
      const retentionDays = data.retentionDays?.trim() || "30";
      const scheduledDate = data.scheduledDeletionDate?.trim() || "the end of your retention period";
      const restoreUrl = data.restoreUrl?.trim() || accountUrl();
      return {
        subject: "Your Nabus Motors account deletion is scheduled",
        whatsapp: `Nabus Motors: We received your account deletion request. Personal data was removed immediately. Business records are retained until ${scheduledDate} (${retentionDays} days). You cannot sign in during this period. To cancel: ${restoreUrl}`,
        emailText: `Hi ${name},\n\nWe received your request to delete your Nabus Motors account.\n\nWhat happens now:\n- Your login has been deactivated immediately\n- Personal data (saved vehicles, cart, messages, preferences) has been removed\n- Business records (orders, invoices, shipments, appointments) are retained for legal and operational purposes\n- Permanent anonymization is scheduled for ${scheduledDate} (${retentionDays}-day retention)\n\nDuring the retention period you may contact support or visit ${restoreUrl} to cancel deletion.\n\nAfter ${scheduledDate}, remaining records will be anonymized and cannot be recovered.\n\nNabus Motors and Trading`,
      };
    }
    case "account_deletion_cancelled": {
      return {
        subject: "Your Nabus Motors account deletion was cancelled",
        whatsapp: `Nabus Motors: Your account deletion request was cancelled. You can sign in again at ${accountUrl()}. Update your profile if needed.`,
        emailText: `Hi ${name},\n\nYour account deletion request has been cancelled. You can sign in again at ${accountUrl()}.\n\nPersonal settings removed during the request will need to be reconfigured.\n\nNabus Motors and Trading`,
      };
    }
    case "account_deletion_completed": {
      const scheduledDate = data.scheduledDeletionDate?.trim() || "";
      return {
        subject: "Your Nabus Motors account has been permanently anonymized",
        whatsapp: `Nabus Motors: Your account retention period${scheduledDate ? ` ending ${scheduledDate}` : ""} has passed. Personal data has been permanently anonymized. Business records are retained in anonymized form.`,
        emailText: `Hi,\n\nYour Nabus Motors account retention period has ended. Personal identifiers have been permanently anonymized. Required business records are retained in anonymized form for legal and operational purposes.\n\nThis action cannot be undone.\n\nNabus Motors and Trading`,
      };
    }
    default:
      return {
        subject: "Nabus Motors update",
        whatsapp: "Nabus Motors: Thank you for choosing Nabus Motors.",
        emailText: `Hi ${name},\n\nThank you for choosing Nabus Motors.\n`,
      };
  }
}
