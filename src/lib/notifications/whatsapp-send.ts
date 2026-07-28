import "server-only";
import { toWhatsAppE164 } from "@/lib/notifications/phone";
import { sendTermiiWhatsApp } from "@/lib/notifications/termii";
import { getWhatsAppConfig } from "@/lib/notifications/whatsapp-config";
import {
  isMetaRetryableError,
  sendMetaTemplateMessage,
  sendMetaTextMessage,
} from "@/lib/notifications/whatsapp-meta";
import {
  buildMetaTemplatePayload,
  type MetaTemplateKind,
  type MetaTemplatePayload,
} from "@/lib/notifications/whatsapp-meta-templates";
import {
  findNotificationByIdempotencyKey,
  insertWhatsAppNotificationLog,
  markWhatsAppSendOutcome,
} from "@/lib/notifications/whatsapp-log";

export type WhatsAppSendOptions = {
  /** Meta Cloud API template payload (preferred for customer-care window). */
  metaTemplate?: MetaTemplatePayload;
  /** Build Meta template from registry + settings when provider is meta. */
  metaTemplateKind?: MetaTemplateKind;
  metaTemplateBodyParameters?: string[];
  metaTemplateButtonUrl?: string;
  /** Prefer Meta template when provider is meta and template is provided. */
  preferMetaTemplate?: boolean;
  idempotencyKey?: string;
  template?: string;
  sourceTable?: string;
  sourceId?: string;
  /** When false, skip notification_log writes (caller logs). Default true when template set. */
  persistLog?: boolean;
  /** Existing log row to update (retry cron). */
  logId?: string;
  currentRetryCount?: number;
};

export type WhatsAppSendResult =
  | {
      sent: true;
      provider: "twilio" | "meta" | "termii";
      messageId?: string;
      deduped?: boolean;
      logId?: string | null;
    }
  | {
      sent: false;
      reason: string;
      waMeUrl?: string;
      errorCode?: string;
      retryable?: boolean;
      logId?: string | null;
    };

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

  const text = await response.text();
  if (!response.ok) {
    return {
      sent: false,
      reason: `Twilio error (${response.status}): ${text.slice(0, 200)}`,
      retryable: response.status === 429 || response.status >= 500,
    };
  }

  let messageId: string | undefined;
  try {
    const data = JSON.parse(text) as { sid?: string };
    messageId = data.sid;
  } catch {
    // ignore
  }

  return { sent: true, provider: "twilio", messageId };
}

function resolveMetaTemplate(
  config: Awaited<ReturnType<typeof getWhatsAppConfig>>,
  options?: WhatsAppSendOptions
): MetaTemplatePayload | undefined {
  if (options?.metaTemplate) return options.metaTemplate;
  if (!options?.metaTemplateKind) return undefined;
  return buildMetaTemplatePayload({
    kind: options.metaTemplateKind,
    settings: config.settings,
    bodyParameters: options.metaTemplateBodyParameters,
    buttonUrlParameter: options.metaTemplateButtonUrl,
  });
}

async function sendViaMeta(
  to: string,
  body: string,
  config: Awaited<ReturnType<typeof getWhatsAppConfig>>,
  options?: WhatsAppSendOptions
): Promise<WhatsAppSendResult> {
  const template = resolveMetaTemplate(config, options);
  const useTemplate = Boolean(
    template && (options?.preferMetaTemplate || options?.metaTemplateKind || options?.metaTemplate)
  );
  const result = useTemplate
    ? await sendMetaTemplateMessage({
        phoneNumberId: config.phoneNumberId,
        accessToken: config.metaAccessToken,
        toE164: to,
        template: template!,
      })
    : await sendMetaTextMessage({
        phoneNumberId: config.phoneNumberId,
        accessToken: config.metaAccessToken,
        toE164: to,
        body,
      });

  if (!result.sent) {
    return {
      sent: false,
      reason: result.reason,
      errorCode: result.errorCode,
      retryable: isMetaRetryableError(result.status, result.errorCode),
    };
  }

  return { sent: true, provider: "meta", messageId: result.messageId };
}

/**
 * Central WhatsApp send path. Never throws — failures return `{ sent: false }`.
 * Optional third argument adds Meta templates, idempotency, and delivery logging.
 */
export async function sendWhatsAppMessage(
  phone: string,
  body: string,
  options?: WhatsAppSendOptions
): Promise<WhatsAppSendResult> {
  try {
    const config = await getWhatsAppConfig();
    const e164 = toWhatsAppE164(phone);
    const waMeUrl = e164
      ? `https://wa.me/${e164.replace("+", "")}?text=${encodeURIComponent(body)}`
      : undefined;
    const shouldPersist =
      options?.persistLog ?? Boolean(options?.template || options?.idempotencyKey || options?.logId);

    if (!e164) {
      return { sent: false, reason: "Invalid phone number", waMeUrl };
    }

    if (options?.idempotencyKey) {
      const existing = await findNotificationByIdempotencyKey(options.idempotencyKey);
      if (
        existing &&
        (existing.status === "sent" ||
          existing.status === "delivered" ||
          existing.status === "read" ||
          existing.status === "queued")
      ) {
        return {
          sent: true,
          provider: (existing.provider as "twilio" | "meta" | "termii") || "meta",
          messageId: existing.provider_message_id ?? undefined,
          deduped: true,
          logId: existing.id,
        };
      }
    }

    let logId = options?.logId ?? null;
    if (shouldPersist && !logId) {
      logId = await insertWhatsAppNotificationLog({
        sourceTable: options?.sourceTable,
        sourceId: options?.sourceId,
        template: options?.template ?? "whatsapp_message",
        status: "queued",
        recipient: phone,
        idempotencyKey: options?.idempotencyKey,
        retryCount: options?.currentRetryCount ?? 0,
      });
    }

    if (!config.enabled) {
      await markWhatsAppSendOutcome({
        logId,
        sent: false,
        deferred: true,
        reason: "WhatsApp sending is disabled (WHATSAPP_ENABLED / whatsapp_enabled).",
        waMeUrl,
        waMeText: body,
      });
      return {
        sent: false,
        reason: "WhatsApp sending is disabled (WHATSAPP_ENABLED / whatsapp_enabled).",
        waMeUrl,
        logId,
      };
    }

    if (!config.configured) {
      console.info(
        "[whatsapp] API not configured — manual send template:",
        waMeUrl ?? "(no wa.me link)"
      );
      await markWhatsAppSendOutcome({
        logId,
        sent: false,
        deferred: true,
        reason: "WhatsApp API not configured",
        waMeUrl,
        waMeText: body,
      });
      return {
        sent: false,
        reason:
          "WhatsApp API not configured. Enable TWILIO_* or WHATSAPP_* env vars, or set API keys in Platform → Settings.",
        waMeUrl,
        logId,
      };
    }

    let result: WhatsAppSendResult;
    if (config.provider === "termii") {
      const termii = await sendTermiiWhatsApp(phone, body);
      result = termii.sent
        ? { sent: true, provider: "termii", messageId: termii.messageId }
        : { sent: false, reason: termii.reason, waMeUrl, retryable: true };
    } else if (config.provider === "twilio") {
      result = await sendViaTwilio(e164, body, config);
      if (!result.sent) result = { ...result, waMeUrl };
    } else if (config.provider === "meta") {
      result = await sendViaMeta(e164, body, config, options);
      if (!result.sent) result = { ...result, waMeUrl };
    } else {
      result = { sent: false, reason: "Unknown WhatsApp provider", waMeUrl };
    }

    await markWhatsAppSendOutcome({
      logId,
      sent: result.sent,
      provider: result.sent ? result.provider : config.provider || undefined,
      messageId: result.sent ? result.messageId : undefined,
      reason: result.sent ? undefined : result.reason,
      errorCode: result.sent ? undefined : result.errorCode,
      retryable: result.sent ? false : Boolean(result.retryable),
      currentRetryCount: options?.currentRetryCount ?? 0,
      waMeUrl: result.sent ? undefined : result.waMeUrl,
      waMeText: result.sent ? undefined : body,
    });

    return { ...result, logId };
  } catch (error) {
    const message = error instanceof Error ? error.message : "WhatsApp send failed";
    return { sent: false, reason: message };
  }
}

/**
 * Uniform wrapper used by feature code that wants logging/idempotency defaults.
 * Still routes through `sendWhatsAppMessage`.
 */
export async function sendWhatsApp(
  phone: string,
  body: string,
  options?: WhatsAppSendOptions
): Promise<WhatsAppSendResult> {
  return sendWhatsAppMessage(phone, body, {
    persistLog: true,
    ...options,
  });
}
