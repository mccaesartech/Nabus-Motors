import "server-only";
import { sendCustomerNotificationEmail } from "@/lib/notifications/customer-email";
import { toWhatsAppE164 } from "@/lib/notifications/phone";
import { sendWhatsAppMessage } from "@/lib/notifications/whatsapp-send";
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
  const whatsappRaw = settings.whatsapp_number?.trim() || settings.phone?.trim() || "";

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

  if (whatsappRaw) {
    const e164 = toWhatsAppE164(whatsappRaw);
    if (e164) {
      const wa = await sendWhatsAppMessage(e164, params.message);
      if (!wa.sent) {
        console.warn("[admin-notify] WhatsApp failed:", wa.reason);
      }
    }
  }
}
