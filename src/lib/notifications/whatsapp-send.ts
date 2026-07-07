import "server-only";
import { toWhatsAppE164 } from "@/lib/notifications/phone";
import { sendTermiiWhatsApp } from "@/lib/notifications/termii";
import { getWhatsAppConfig } from "@/lib/notifications/whatsapp-config";

export type WhatsAppSendResult =
  | { sent: true; provider: "twilio" | "meta" | "termii" }
  | { sent: false; reason: string; waMeUrl?: string };

async function sendViaTwilio(
  to: string,
  body: string,
  config: Awaited<ReturnType<typeof getWhatsAppConfig>>
): Promise<WhatsAppSendResult> {
  const auth = Buffer.from(`${config.twilioAccountSid}:${config.twilioAuthToken}`).toString(
    "base64"
  );
  const from = config.twilioFrom.startsWith("whatsapp:")
    ? config.twilioFrom
    : `whatsapp:${config.twilioFrom.startsWith("+") ? config.twilioFrom : `+${config.twilioFrom}`}`;
  const toAddress = to.startsWith("whatsapp:") ? to : `whatsapp:${to}`;

  const response = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${config.twilioAccountSid}/Messages.json`,
    {
      method: "POST",
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        From: from,
        To: toAddress,
        Body: body,
      }),
    }
  );

  if (!response.ok) {
    const text = await response.text();
    return { sent: false, reason: `Twilio error (${response.status}): ${text.slice(0, 200)}` };
  }

  return { sent: true, provider: "twilio" };
}

async function sendViaMeta(
  to: string,
  body: string,
  config: Awaited<ReturnType<typeof getWhatsAppConfig>>
): Promise<WhatsAppSendResult> {
  const digits = to.replace(/\D/g, "");
  const response = await fetch(
    `https://graph.facebook.com/v21.0/${config.phoneNumberId}/messages`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.metaAccessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to: digits,
        type: "text",
        text: { body },
      }),
    }
  );

  if (!response.ok) {
    const text = await response.text();
    return { sent: false, reason: `Meta WhatsApp error (${response.status}): ${text.slice(0, 200)}` };
  }

  return { sent: true, provider: "meta" };
}

export async function sendWhatsAppMessage(
  phone: string,
  body: string
): Promise<WhatsAppSendResult> {
  const config = await getWhatsAppConfig();
  const e164 = toWhatsAppE164(phone);
  const waMeUrl = e164
    ? `https://wa.me/${e164.replace("+", "")}?text=${encodeURIComponent(body)}`
    : undefined;

  if (!e164) {
    return { sent: false, reason: "Invalid phone number", waMeUrl };
  }

  if (!config.configured) {
    console.info(
      "[whatsapp] API not configured — manual send template:",
      waMeUrl ?? "(no wa.me link)"
    );
    return {
      sent: false,
      reason: "WhatsApp API not configured. Enable TWILIO_* or WHATSAPP_* env vars, or set API keys in Platform → Settings.",
      waMeUrl,
    };
  }

  try {
    if (config.provider === "termii") {
      const result = await sendTermiiWhatsApp(phone, body);
      if (result.sent) {
        return { sent: true, provider: "termii" };
      }
      return { sent: false, reason: result.reason, waMeUrl };
    }
    if (config.provider === "twilio") {
      return await sendViaTwilio(e164, body, config);
    }
    if (config.provider === "meta") {
      return await sendViaMeta(e164, body, config);
    }
    return { sent: false, reason: "Unknown WhatsApp provider", waMeUrl };
  } catch (error) {
    const message = error instanceof Error ? error.message : "WhatsApp send failed";
    return { sent: false, reason: message, waMeUrl };
  }
}
