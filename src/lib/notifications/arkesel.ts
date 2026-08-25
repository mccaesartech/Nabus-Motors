import "server-only";
import { normalizePhoneDigits } from "@/lib/notifications/phone";
import {
  getArkeselConfig,
  isArkeselConfigReady,
  type ArkeselConfig,
} from "@/lib/notifications/arkesel-config";
import { enqueueAuditLog } from "@/lib/audit/write";

export type ArkeselSendResult =
  | { sent: true; provider: "arkesel"; channel: "sms"; messageId?: string }
  | { sent: false; reason: string };

/**
 * Arkesel v2 returns `data` as an array of per-recipient entries. Recipients the
 * gateway would not accept are reported inside an `"invalid numbers"` entry
 * while the overall `status` still reads `success`.
 */
type ArkeselRecipientEntry = {
  recipient?: string;
  id?: string | number;
  message_id?: string;
  "invalid numbers"?: string[];
  invalid_numbers?: string[];
};

type ArkeselApiResponse = {
  status?: string;
  message?: string;
  data?: ArkeselRecipientEntry | ArkeselRecipientEntry[];
  // Some responses nest ids at the top level.
  id?: string | number;
  message_id?: string;
};

/** Documented Arkesel v2 status responses. */
const ARKESEL_HTTP_REASONS: Record<number, string> = {
  401: "Arkesel authentication failed — check ARKESEL_API_KEY.",
  402: "Arkesel account is out of SMS credit — top up the Arkesel account.",
  403: "Arkesel gateway is inactive — check that the sender ID is approved and the account is active.",
  422: "Arkesel rejected the request (validation error) — check the sender ID length and recipient format.",
  500: "Arkesel had an internal error — retry shortly.",
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

function toRecipientEntries(
  data: ArkeselApiResponse["data"]
): ArkeselRecipientEntry[] {
  if (!data) return [];
  return Array.isArray(data) ? data : [data];
}

function collectInvalidNumbers(entries: ArkeselRecipientEntry[]): string[] {
  return entries.flatMap((entry) => entry["invalid numbers"] ?? entry.invalid_numbers ?? []);
}

function collectAcceptedIds(entries: ArkeselRecipientEntry[]): string[] {
  return entries
    .map((entry) => entry.message_id ?? (entry.id != null ? String(entry.id) : undefined))
    .filter((id): id is string => Boolean(id));
}

function extractMessageId(
  data: ArkeselApiResponse,
  entries: ArkeselRecipientEntry[]
): string | undefined {
  const [fromEntries] = collectAcceptedIds(entries);
  if (fromEntries) return fromEntries;
  if (data.message_id) return data.message_id;
  if (data.id != null) return String(data.id);
  return undefined;
}

function auditArkeselResult(result: ArkeselSendResult): ArkeselSendResult {
  if (result.sent) {
    enqueueAuditLog({
      action: "sms_sent",
      success: true,
      targetType: "sms",
      metadata: { provider: "arkesel", channel: "sms" },
    });
  } else {
    enqueueAuditLog({
      action: "sms_failed",
      success: false,
      targetType: "sms",
      errorMessage: result.reason.slice(0, 500),
      metadata: { provider: "arkesel" },
    });
  }
  return result;
}

export async function sendArkeselSms(
  phone: string,
  body: string,
  config?: ArkeselConfig
): Promise<ArkeselSendResult> {
  const cfg = config ?? (await getArkeselConfig());
  const to = toArkeselPhone(phone);

  if (!to) {
    return auditArkeselResult({ sent: false, reason: "Invalid phone number" });
  }
  if (!cfg.smsReady) {
    return auditArkeselResult({
      sent: false,
      reason:
        "Arkesel SMS not configured. Set ARKESEL_API_KEY and ARKESEL_SENDER_ID in Vercel, or configure in Platform → Settings → SMS (Arkesel).",
    });
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
      const documented = ARKESEL_HTTP_REASONS[response.status];
      const providerText = (data.message ?? text).slice(0, 200).trim();
      return auditArkeselResult({
        sent: false,
        reason: documented
          ? `${documented}${providerText ? ` (Arkesel ${response.status}: ${providerText})` : ""}`
          : `Arkesel error (${response.status}): ${providerText}`,
      });
    }

    const status = data.status?.toLowerCase();
    if (status && status !== "success" && status !== "ok") {
      return auditArkeselResult({
        sent: false,
        reason: `Arkesel error: ${(data.message ?? data.status ?? "unknown").slice(0, 200)}`,
      });
    }

    // A 200 with `status: success` still drops recipients the gateway rejected,
    // so treat a rejected recipient as a failure rather than reporting "sent".
    const entries = toRecipientEntries(data.data);
    const invalidNumbers = collectInvalidNumbers(entries);
    const acceptedIds = collectAcceptedIds(entries);
    if (invalidNumbers.includes(to) || (acceptedIds.length === 0 && invalidNumbers.length > 0)) {
      return auditArkeselResult({
        sent: false,
        reason: `Arkesel rejected ${to} as an invalid number — store the recipient in international format (233XXXXXXXXX).`,
      });
    }

    // Only treat as accepted when Arkesel returns a real message id. HTTP 200
    // alone is not proof of queueing; Owner UI never means handset delivery.
    const messageId = extractMessageId(data, entries);
    if (!messageId) {
      return auditArkeselResult({
        sent: false,
        reason:
          "Arkesel returned success without a message id — check sender ID approval, balance, and the recipient format (233XXXXXXXXX).",
      });
    }

    return auditArkeselResult({
      sent: true,
      provider: "arkesel",
      channel: "sms",
      messageId,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Arkesel SMS send failed";
    return auditArkeselResult({ sent: false, reason: message });
  }
}
