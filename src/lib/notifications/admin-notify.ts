import "server-only";
import { sendCustomerNotificationEmail } from "@/lib/notifications/customer-email";
import { toWhatsAppE164 } from "@/lib/notifications/phone";
import { sendWhatsAppMessage } from "@/lib/notifications/whatsapp-send";
import { sendArkeselSms } from "@/lib/notifications/arkesel";
import {
  getArkeselConfig,
  shouldPreferArkeselSms,
} from "@/lib/notifications/arkesel-config";
import type { OperationalSettings } from "@/lib/platform/site-settings";
import { getSiteSettings } from "@/lib/platform/site-settings-server";

export async function notifyAdminOutbound(params: {
  subject: string;
  message: string;
  settings?: OperationalSettings;
}): Promise<void> {
  const settings = params.settings ?? (await getSiteSettings());
  const email =
    settings.notification_email?.trim() || settings.email?.trim() || "";
  const phoneRaw = settings.whatsapp_number?.trim() || settings.phone?.trim() || "";

  if (settings.notifyEmailEnabled && email) {
    const result = await sendCustomerNotificationEmail({
      to: email,
      subject: params.subject,
      text: params.message,
    });
    if (!result.emailSent && result.emailError) {
      console.warn("[admin-notify] email failed:", result.emailError);
    }
  }

  if (!phoneRaw) return;

  const e164 = toWhatsAppE164(phoneRaw);
  if (!e164) return;

  const preferSms = await shouldPreferArkeselSms();
  if (preferSms) {
    const sms = await sendArkeselSms(e164, params.message);
    if (!sms.sent) {
      console.warn("[admin-notify] Arkesel SMS failed (non-blocking):", sms.reason);
    }
    return;
  }

  const wa = await sendWhatsAppMessage(e164, params.message);
  if (wa.sent) return;

  console.warn("[admin-notify] WhatsApp failed:", wa.reason);
  const arkesel = await getArkeselConfig();
  if (!arkesel.smsReady) return;

  const sms = await sendArkeselSms(e164, params.message, arkesel);
  if (!sms.sent) {
    console.warn("[admin-notify] Arkesel SMS fallback failed (non-blocking):", sms.reason);
  }
}
