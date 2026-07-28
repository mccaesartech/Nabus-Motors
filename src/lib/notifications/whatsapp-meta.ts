import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import type { MetaTemplatePayload } from "@/lib/notifications/whatsapp-meta-templates";

export type MetaConnectionStatus = {
  configured: boolean;
  phoneNumberId: string;
  businessAccountId: string;
  hasAccessToken: boolean;
  graphVersion: string;
};

export type MetaSendResult =
  | { sent: true; messageId?: string }
  | { sent: false; reason: string; errorCode?: string; status?: number };

const GRAPH_VERSION = "v21.0";

export function getMetaGraphVersion(): string {
  return process.env.WHATSAPP_GRAPH_VERSION?.trim() || GRAPH_VERSION;
}

export function getMetaConnectionStatus(input: {
  phoneNumberId?: string;
  accessToken?: string;
  businessAccountId?: string;
}): MetaConnectionStatus {
  const phoneNumberId = input.phoneNumberId?.trim() || "";
  const accessToken = input.accessToken?.trim() || "";
  const businessAccountId = input.businessAccountId?.trim() || "";
  return {
    configured: Boolean(phoneNumberId && accessToken),
    phoneNumberId,
    businessAccountId,
    hasAccessToken: Boolean(accessToken),
    graphVersion: getMetaGraphVersion(),
  };
}

function messagesUrl(phoneNumberId: string): string {
  return `https://graph.facebook.com/${getMetaGraphVersion()}/${phoneNumberId}/messages`;
}

async function postMetaMessage(
  phoneNumberId: string,
  accessToken: string,
  payload: Record<string, unknown>
): Promise<MetaSendResult> {
  const response = await fetch(messagesUrl(phoneNumberId), {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  const text = await response.text();
  let data: {
    messages?: Array<{ id?: string }>;
    error?: { message?: string; code?: number | string };
  } = {};
  try {
    data = JSON.parse(text) as typeof data;
  } catch {
    // non-JSON
  }

  if (!response.ok) {
    const message = data.error?.message ?? text;
    return {
      sent: false,
      reason: `Meta WhatsApp error (${response.status}): ${String(message).slice(0, 200)}`,
      errorCode: data.error?.code != null ? String(data.error.code) : undefined,
      status: response.status,
    };
  }

  return {
    sent: true,
    messageId: data.messages?.[0]?.id,
  };
}

export async function sendMetaTextMessage(params: {
  phoneNumberId: string;
  accessToken: string;
  toE164: string;
  body: string;
}): Promise<MetaSendResult> {
  const digits = params.toE164.replace(/\D/g, "");
  return postMetaMessage(params.phoneNumberId, params.accessToken, {
    messaging_product: "whatsapp",
    to: digits,
    type: "text",
    text: { body: params.body },
  });
}

export async function sendMetaTemplateMessage(params: {
  phoneNumberId: string;
  accessToken: string;
  toE164: string;
  template: MetaTemplatePayload;
}): Promise<MetaSendResult> {
  const digits = params.toE164.replace(/\D/g, "");
  return postMetaMessage(params.phoneNumberId, params.accessToken, {
    messaging_product: "whatsapp",
    to: digits,
    type: "template",
    template: params.template,
  });
}

/** Verify Meta `X-Hub-Signature-256` against the raw request body. */
export function verifyMetaWebhookSignature(
  rawBody: string | Buffer,
  signatureHeader: string | null | undefined,
  appSecret: string
): boolean {
  const secret = appSecret.trim();
  const header = signatureHeader?.trim() ?? "";
  if (!secret || !header.startsWith("sha256=")) return false;

  const expected = createHmac("sha256", secret).update(rawBody).digest("hex");
  const provided = header.slice("sha256=".length);
  try {
    const expectedBuf = Buffer.from(expected, "utf8");
    const providedBuf = Buffer.from(provided, "utf8");
    if (expectedBuf.length !== providedBuf.length) return false;
    return timingSafeEqual(expectedBuf, providedBuf);
  } catch {
    return false;
  }
}

/** Map Meta webhook status strings to notification_log statuses. */
export function mapMetaWebhookStatus(
  status: string | undefined
): "sent" | "delivered" | "read" | "failed" | "undeliverable" | null {
  switch ((status ?? "").toLowerCase()) {
    case "sent":
      return "sent";
    case "delivered":
      return "delivered";
    case "read":
      return "read";
    case "failed":
      return "failed";
    case "deleted":
    case "warned":
      return "undeliverable";
    default:
      return null;
  }
}

export function isMetaRetryableError(status?: number, errorCode?: string): boolean {
  if (status === 429 || status === 500 || status === 502 || status === 503 || status === 504) {
    return true;
  }
  // Meta rate-limit / temporary errors
  const code = Number(errorCode);
  return code === 4 || code === 80007 || code === 130429;
}
