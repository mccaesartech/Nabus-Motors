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
import { sendArkeselSms } from "@/lib/notifications/arkesel";
import {
  getArkeselConfig,
  shouldPreferArkeselSms,
} from "@/lib/notifications/arkesel-config";

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

async function trySmsDelivery(
  phone: string,
  body: string,
  params: NotifyCustomerParams,
  result: NotifyCustomerResult
): Promise<boolean> {
  const arkesel = await getArkeselConfig();
  if (arkesel.smsReady) {
    const sms = await sendArkeselSms(phone, body, arkesel);
    if (sms.sent) {
      result.channels.push("sms");
      await logNotification({
        sourceTable: params.sourceTable,
        sourceId: params.sourceId,
        template: params.template,
        channel: "sms",
        status: "sent",
        recipient: phone,
        detail: `arkesel message_id=${sms.messageId ?? "unknown"}`,
      });
      return true;
    }
    console.warn(
      "[notifyCustomer] Arkesel SMS failed (non-blocking):",
      sms.reason
    );
  }

  if (!(await shouldTryTermiiSms())) return false;
  const termii = await getTermiiConfig();
  if (!termii.smsReady) return false;

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
    return true;
  }
  return false;
}

function buildLogDetail(input: {
  reason?: string;
  waMeUrl?: string;
  waMeText?: string;
  technical?: string;
}): string {
  if (input.waMeUrl || input.waMeText) {
    return JSON.stringify({
      reason: input.reason,
      waMeUrl: input.waMeUrl,
      waMeText: input.waMeText,
    });
  }
  if (input.technical) {
    return JSON.stringify({ reason: input.reason ?? input.technical });
  }
  return input.reason ?? "";
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
  const preferSms = phone ? await shouldPreferArkeselSms() : false;

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
  } else if (preferSms) {
    // SMS primary — leave WhatsApp dormant. Keep provider routing in server logs only.
    result.whatsappStatus = "skipped";
    console.info("[notifyCustomer] WhatsApp skipped; SMS preferred as primary channel");
    await trySmsDelivery(phone, content.whatsapp, params, result);
  } else if (!whatsappCapable) {
    result.whatsappStatus = "skipped";
    result.whatsappReason = "WhatsApp not sent (customer opted out)";
    await trySmsDelivery(phone, content.whatsapp, params, result);
  } else {
    const resetUrl = params.data?.passwordResetUrl?.trim();
    const usePasswordResetTemplate = params.template === "password_reset" && Boolean(resetUrl);
    const wa = await sendWhatsAppMessage(phone, content.whatsapp, {
      template: params.template,
      sourceTable: params.sourceTable,
      sourceId: params.sourceId,
      persistLog: true,
      idempotencyKey:
        params.sourceTable && params.sourceId
          ? `customer:${params.template}:${params.sourceTable}:${params.sourceId}`
          : undefined,
      ...(usePasswordResetTemplate
        ? {
            metaTemplateKind: "password_reset" as const,
            metaTemplateBodyParameters: [
              params.customerName ?? params.data?.customerName ?? "there",
              resetUrl!,
            ],
            metaTemplateButtonUrl: resetUrl,
            preferMetaTemplate: true,
          }
        : {}),
    });
    if (wa.sent) {
      result.whatsappSent = true;
      result.whatsappStatus = "sent";
      result.channels.push("whatsapp");
      // Delivery row is persisted by sendWhatsAppMessage when persistLog is true.
      if (!wa.logId) {
        await logNotification({
          sourceTable: params.sourceTable,
          sourceId: params.sourceId,
          template: params.template,
          channel: "whatsapp",
          status: "sent",
          recipient: phone,
          detail: wa.provider,
        });
      }
    } else if (wa.waMeUrl) {
      result.whatsappDeferred = true;
      result.whatsappStatus = "deferred";
      result.whatsappReason = sanitizeNotificationReason(wa.reason);
      console.info(
        "[notifyCustomer] WhatsApp deferred for manual follow-up; recipient and message omitted"
      );
      if (!wa.logId) {
        await logNotification({
          sourceTable: params.sourceTable,
          sourceId: params.sourceId,
          template: params.template,
          channel: "whatsapp",
          status: "deferred",
          recipient: phone,
          detail: buildLogDetail({
            reason: "WhatsApp API not configured",
            waMeUrl: wa.waMeUrl,
            waMeText: content.whatsapp,
          }),
        });
      }
      // Prefer SMS when WhatsApp is only deferred (API not configured).
      await trySmsDelivery(phone, content.whatsapp, params, result);
    } else {
      result.whatsappStatus = "failed";
      result.whatsappReason = sanitizeNotificationReason(wa.reason);
      if (!wa.logId) {
        await logNotification({
          sourceTable: params.sourceTable,
          sourceId: params.sourceId,
          template: params.template,
          channel: "whatsapp",
          status: "failed",
          recipient: phone,
          detail: buildLogDetail({
            reason: sanitizeNotificationReason(wa.reason),
            technical: wa.reason,
          }),
        });
      }
      await trySmsDelivery(phone, content.whatsapp, params, result);
    }
  }

  if (email && !params.skipEmail) {
    let subject = content.subject;
    let text = content.emailText;
    let html: string | undefined;

    if (params.template === "password_reset") {
      const resetUrl = params.data?.passwordResetUrl?.trim();
      if (resetUrl) {
        const { passwordResetEmail } = await import("@/lib/email/branded-templates");
        const branded = passwordResetEmail(
          params.customerName ?? params.data?.customerName ?? "",
          resetUrl
        );
        subject = branded.subject;
        text = branded.text;
        html = branded.html;
      }
    }

    const mail = await sendCustomerNotificationEmail({
      to: email,
      subject,
      text,
      html,
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
      console.info("[notifyCustomer] email not sent; recipient and provider detail omitted", {
        status: result.emailStatus,
      });
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
