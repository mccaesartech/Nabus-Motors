import "server-only";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { sendCustomerNotificationEmail } from "@/lib/notifications/customer-email";
import { defaultWhatsAppOptIn } from "@/lib/notifications/phone";
import {
  buildCustomerMessage,
  type CustomerNotifyTemplate,
} from "@/lib/notifications/templates";
import {
  sanitizeNotificationReason,
  type CustomerNotificationPayload,
} from "@/lib/notifications/notification-status";
import { sendWhatsAppMessage } from "@/lib/notifications/whatsapp-send";
import { sendTermiiSms } from "@/lib/notifications/termii";
import { getTermiiConfig, isTermiiProviderEnv } from "@/lib/notifications/termii-config";
import { getWhatsAppConfig } from "@/lib/notifications/whatsapp-config";

export type NotifyCustomerParams = {
  email?: string;
  phone?: string | null;
  whatsappPreferred?: boolean;
  template: CustomerNotifyTemplate;
  data?: Record<string, string | undefined>;
  customerName?: string;
  sourceTable?: string;
  sourceId?: string;
  /** When true, email delivery failures are never downgraded to "skipped". */
  emailRequired?: boolean;
  /** Skip Resend email (e.g. Supabase auth email already sent). WhatsApp still attempts. */
  skipEmail?: boolean;
};

export type NotifyCustomerResult = CustomerNotificationPayload;

function resolveWhatsAppPreferred(
  phone: string | null | undefined,
  explicit?: boolean
): boolean {
  const trimmed = phone?.trim() ?? "";
  if (!trimmed) return false;
  if (explicit === true) return true;
  if (explicit === false) return false;
  return defaultWhatsAppOptIn(trimmed);
}

async function shouldTryTermiiSms(): Promise<boolean> {
  if (isTermiiProviderEnv()) return true;
  const [termii, whatsapp] = await Promise.all([getTermiiConfig(), getWhatsAppConfig()]);
  return termii.smsReady && whatsapp.provider === "termii";
}

async function tryTermiiSmsFallback(
  phone: string,
  body: string,
  params: NotifyCustomerParams,
  result: NotifyCustomerResult
): Promise<void> {
  if (!(await shouldTryTermiiSms())) return;
  const termii = await getTermiiConfig();
  if (!termii.smsReady) return;

  const sms = await sendTermiiSms(phone, body);
  if (sms.sent) {
    result.channels.push("sms");
    await logNotification({
      sourceTable: params.sourceTable,
      sourceId: params.sourceId,
      template: params.template,
      channel: "sms",
      status: "sent",
      recipient: phone,
      detail: `termii message_id=${sms.messageId ?? "unknown"}`,
    });
  }
}
async function logNotification(row: {
  sourceTable?: string;
  sourceId?: string;
  template: string;
  channel: string;
  status: string;
  recipient: string;
  detail?: string;
}) {
  const supabase = createAdminSupabase();
  if (!supabase) return;

  try {
    await supabase.from("notification_log").insert({
      source_table: row.sourceTable ?? null,
      source_id: row.sourceId ?? null,
      template: row.template,
      channel: row.channel,
      status: row.status,
      recipient: row.recipient,
      detail: row.detail ?? null,
    });
  } catch {
    // Table may not exist yet — non-blocking
  }
}

export async function notifyCustomer(
  params: NotifyCustomerParams
): Promise<NotifyCustomerResult> {
  const email = params.email?.trim() ?? "";
  const phone = params.phone?.trim() || null;
  const whatsappCapable = resolveWhatsAppPreferred(phone, params.whatsappPreferred);
  const messageData = {
    ...params.data,
    customerName: params.customerName ?? params.data?.customerName,
  };
  const content = buildCustomerMessage(params.template, messageData);

  const result: NotifyCustomerResult = {
    whatsappSent: false,
    emailSent: false,
    whatsappDeferred: false,
    saveReferenceOnScreen: false,
    channels: [],
    whatsappStatus: "not_attempted",
    emailStatus: email ? "not_attempted" : "skipped",
    phone,
  };

  if (!phone) {
    result.whatsappStatus = "skipped";
    result.whatsappReason = "WhatsApp not sent (no phone on file)";
  } else if (!whatsappCapable) {
    result.whatsappStatus = "skipped";
    result.whatsappReason = "WhatsApp not sent (customer opted out)";
    await tryTermiiSmsFallback(phone, content.whatsapp, params, result);
  } else {
    const wa = await sendWhatsAppMessage(phone, content.whatsapp);
    if (wa.sent) {
      result.whatsappSent = true;
      result.whatsappStatus = "sent";
      result.channels.push("whatsapp");
      await logNotification({
        sourceTable: params.sourceTable,
        sourceId: params.sourceId,
        template: params.template,
        channel: "whatsapp",
        status: "sent",
        recipient: phone,
        detail: wa.provider,
      });
    } else if (wa.waMeUrl) {
      result.whatsappDeferred = true;
      result.whatsappStatus = "deferred";
      result.whatsappReason = sanitizeNotificationReason(wa.reason);
      console.info("[notifyCustomer] WhatsApp deferred (manual):", wa.waMeUrl);
      await logNotification({
        sourceTable: params.sourceTable,
        sourceId: params.sourceId,
        template: params.template,
        channel: "whatsapp",
        status: "deferred",
        recipient: phone,
        detail: `${wa.reason ?? "API not configured"} | ${wa.waMeUrl}`,
      });
    } else {
      result.whatsappStatus = "failed";
      result.whatsappReason = sanitizeNotificationReason(wa.reason);
      await logNotification({
        sourceTable: params.sourceTable,
        sourceId: params.sourceId,
        template: params.template,
        channel: "whatsapp",
        status: "failed",
        recipient: phone,
        detail: wa.reason,
      });
      await tryTermiiSmsFallback(phone, content.whatsapp, params, result);
    }
  }

  if (email && !params.skipEmail) {
    const mail = await sendCustomerNotificationEmail({
      to: email,
      subject: content.subject,
      text: content.emailText,
    });
    if (mail.emailSent) {
      result.emailSent = true;
      result.emailStatus = "sent";
      result.channels.push("email");
      await logNotification({
        sourceTable: params.sourceTable,
        sourceId: params.sourceId,
        template: params.template,
        channel: "email",
        status: "sent",
        recipient: email,
        detail: mail.resendId ? `resend_id=${mail.resendId}` : undefined,
      });
    } else if (mail.emailError) {
      const treatAsFailed = params.emailRequired || !(whatsappCapable && phone);
      result.emailStatus = treatAsFailed ? "failed" : "skipped";
      result.emailReason = sanitizeNotificationReason(mail.emailError);
      console.info("[notifyCustomer] email not sent:", mail.emailError);
      await logNotification({
        sourceTable: params.sourceTable,
        sourceId: params.sourceId,
        template: params.template,
        channel: "email",
        status: result.emailStatus,
        recipient: email,
        detail: mail.emailError,
      });
      if (!whatsappCapable && !phone) {
        result.saveReferenceOnScreen = true;
      }
    }
  } else if (params.skipEmail && email) {
    result.emailStatus = "sent";
    result.emailSent = true;
    if (!result.channels.includes("email")) {
      result.channels.push("email");
    }
  } else if (!email) {
    result.emailStatus = "skipped";
    result.emailReason = "Email not sent (no email on file)";
    if (!whatsappCapable || !phone) {
      result.saveReferenceOnScreen = true;
    }
  } else {
    result.emailStatus = "skipped";
    result.emailReason = "Email skipped";
  }

  return result;
}

export { resolveWhatsAppPreferred };
