import "server-only";
import { normalizePhoneDigits } from "@/lib/notifications/phone";
import {
  getArkeselConfig,
  isArkeselConfigReady,
  type ArkeselConfig,
} from "@/lib/notifications/arkesel-config";

export type ArkeselSendResult =
  | { sent: true; provider: "arkesel"; channel: "sms"; messageId?: string }
  | { sent: false; reason: string };

type ArkeselApiResponse = {
  status?: string;
  message?: string;
  data?: {
    id?: string | number;
    message_id?: string;
    recipients?: unknown;
  };
  // Some responses nest ids at the top level.
  id?: string | number;
  message_id?: string;
};

/** Normalize phone to Arkesel international format (digits only, no +). */
export function toArkeselPhone(phone: string): string {
  return normalizePhoneDigits(phone);
}

export function buildArkeselSmsPayload(input: {
  sender: string;
  message: string;
  recipients: string[];
}): { sender: string; message: string; recipients: string[] } {
  return {
    sender: input.sender.trim(),
    message: input.message,
    recipients: input.recipients.map((r) => r.trim()).filter(Boolean),
  };
}

export { isArkeselConfigReady };

function extractMessageId(data: ArkeselApiResponse): string | undefined {
  const fromData =
    data.data?.message_id ??
    (data.data?.id != null ? String(data.data.id) : undefined);
  if (fromData) return fromData;
  if (data.message_id) return data.message_id;
  if (data.id != null) return String(data.id);
  return undefined;
}

export async function sendArkeselSms(
  phone: string,
  body: string,
  config?: ArkeselConfig
): Promise<ArkeselSendResult> {
  const cfg = config ?? (await getArkeselConfig());
  const to = toArkeselPhone(phone);

  if (!to) {
    return { sent: false, reason: "Invalid phone number" };
  }
  if (!cfg.smsReady) {
    return {
      sent: false,
      reason:
        "Arkesel SMS not configured. Set ARKESEL_API_KEY and ARKESEL_SENDER_ID in Vercel, or configure in Platform → Settings → SMS (Arkesel).",
    };
  }

  const payload = buildArkeselSmsPayload({
    sender: cfg.senderId,
    message: body,
    recipients: [to],
  });

  try {
    const url = `${cfg.baseUrl}/api/v2/sms/send`;
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "api-key": cfg.apiKey,
      },
      body: JSON.stringify(payload),
    });

    const text = await response.text();
    let data: ArkeselApiResponse = {};
    try {
      data = JSON.parse(text) as ArkeselApiResponse;
    } catch {
      // non-JSON error body
    }

    if (!response.ok) {
      return {
        sent: false,
        reason: `Arkesel error (${response.status}): ${(data.message ?? text).slice(0, 200)}`,
      };
    }

    const status = data.status?.toLowerCase();
    if (status && status !== "success" && status !== "ok") {
      return {
        sent: false,
        reason: `Arkesel error: ${(data.message ?? data.status ?? "unknown").slice(0, 200)}`,
      };
    }

    return {
      sent: true,
      provider: "arkesel",
      channel: "sms",
      messageId: extractMessageId(data),
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Arkesel SMS send failed";
    return { sent: false, reason: message };
  }
}
