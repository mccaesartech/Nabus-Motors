import "server-only";
import { normalizePhoneDigits } from "@/lib/notifications/phone";
import { getTermiiConfig, type TermiiConfig } from "@/lib/notifications/termii-config";

export type TermiiSendResult =
  | { sent: true; provider: "termii"; channel: "whatsapp" | "sms"; messageId?: string }
  | { sent: false; reason: string };

type TermiiApiResponse = {
  code?: string;
  message?: string;
  message_id?: string;
  message_id_str?: string;
};

/** Normalize phone to Termii international format (digits only, no +). */
export function toTermiiPhone(phone: string): string {
  return normalizePhoneDigits(phone);
}

async function postTermiiMessage(
  config: TermiiConfig,
  payload: {
    to: string;
    from: string;
    sms: string;
    channel: "whatsapp" | "dnd" | "generic";
  }
): Promise<TermiiSendResult> {
  const url = `${config.baseUrl}/api/sms/send`;
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      api_key: config.apiKey,
      to: payload.to,
      from: payload.from,
      sms: payload.sms,
      type: "plain",
      channel: payload.channel,
    }),
  });

  const text = await response.text();
  let data: TermiiApiResponse = {};
  try {
    data = JSON.parse(text) as TermiiApiResponse;
  } catch {
    // non-JSON error body
  }

  if (!response.ok) {
    return {
      sent: false,
      reason: `Termii error (${response.status}): ${(data.message ?? text).slice(0, 200)}`,
    };
  }

  if (data.code && data.code !== "ok") {
    return {
      sent: false,
      reason: `Termii error: ${(data.message ?? data.code).slice(0, 200)}`,
    };
  }

  const messageId = data.message_id_str ?? data.message_id;
  const channel = payload.channel === "whatsapp" ? "whatsapp" : "sms";
  return { sent: true, provider: "termii", channel, messageId };
}

export async function sendTermiiWhatsApp(
  phone: string,
  body: string,
  config?: TermiiConfig
): Promise<TermiiSendResult> {
  const cfg = config ?? (await getTermiiConfig());
  const to = toTermiiPhone(phone);

  if (!to) {
    return { sent: false, reason: "Invalid phone number" };
  }
  if (!cfg.whatsappReady) {
    return {
      sent: false,
      reason:
        "Termii WhatsApp not configured. Set TERMII_API_KEY and TERMII_WHATSAPP_DEVICE (or TERMII_SENDER_ID) in Vercel, or configure in Platform → Settings.",
    };
  }

  try {
    return await postTermiiMessage(cfg, {
      to,
      from: cfg.whatsappDevice,
      sms: body,
      channel: "whatsapp",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Termii WhatsApp send failed";
    return { sent: false, reason: message };
  }
}

export async function sendTermiiSms(
  phone: string,
  body: string,
  config?: TermiiConfig
): Promise<TermiiSendResult> {
  const cfg = config ?? (await getTermiiConfig());
  const to = toTermiiPhone(phone);

  if (!to) {
    return { sent: false, reason: "Invalid phone number" };
  }
  if (!cfg.smsReady) {
    return {
      sent: false,
      reason:
        "Termii SMS not configured. Set TERMII_API_KEY and TERMII_SENDER_ID in Vercel, or configure in Platform → Settings.",
    };
  }

  try {
    return await postTermiiMessage(cfg, {
      to,
      from: cfg.senderId,
      sms: body,
      channel: cfg.smsChannel,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Termii SMS send failed";
    return { sent: false, reason: message };
  }
}
