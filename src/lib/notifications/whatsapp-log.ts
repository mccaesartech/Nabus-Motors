import "server-only";
import { createAdminSupabase } from "@/lib/supabase/admin";
import {
  computeWhatsAppNextRetryAt,
  shouldMarkWhatsAppUndeliverable,
  WHATSAPP_MAX_RETRY_ATTEMPTS,
} from "@/lib/notifications/whatsapp-retry";

export type NotificationLogStatus =
  | "queued"
  | "sent"
  | "delivered"
  | "read"
  | "failed"
  | "skipped"
  | "deferred"
  | "undeliverable";

export type WhatsAppLogRow = {
  id: string;
  source_table: string | null;
  source_id: string | null;
  template: string;
  channel: string;
  status: string;
  recipient: string;
  detail: string | null;
  provider: string | null;
  provider_message_id: string | null;
  idempotency_key: string | null;
  retry_count: number;
  next_retry_at: string | null;
  error_code: string | null;
};

function buildDetail(input: {
  reason?: string;
  waMeUrl?: string;
  waMeText?: string;
  technical?: string;
  provider?: string;
}): string | null {
  if (input.waMeUrl || input.waMeText) {
    return JSON.stringify({
      reason: input.reason,
      waMeUrl: input.waMeUrl,
      waMeText: input.waMeText,
    });
  }
  if (input.provider && !input.reason) return input.provider;
  if (input.technical || input.reason) {
    return JSON.stringify({
      reason: input.reason ?? input.technical,
      technical: input.technical,
      provider: input.provider,
    });
  }
  return input.provider ?? null;
}

export async function findNotificationByIdempotencyKey(
  idempotencyKey: string
): Promise<WhatsAppLogRow | null> {
  const supabase = createAdminSupabase();
  if (!supabase || !idempotencyKey.trim()) return null;

  try {
    const { data } = await supabase
      .from("notification_log")
      .select(
        "id, source_table, source_id, template, channel, status, recipient, detail, provider, provider_message_id, idempotency_key, retry_count, next_retry_at, error_code"
      )
      .eq("idempotency_key", idempotencyKey.trim())
      .maybeSingle();
    return (data as WhatsAppLogRow | null) ?? null;
  } catch {
    return null;
  }
}

export async function findNotificationByProviderMessageId(
  providerMessageId: string
): Promise<WhatsAppLogRow | null> {
  const supabase = createAdminSupabase();
  if (!supabase || !providerMessageId.trim()) return null;

  try {
    const { data } = await supabase
      .from("notification_log")
      .select(
        "id, source_table, source_id, template, channel, status, recipient, detail, provider, provider_message_id, idempotency_key, retry_count, next_retry_at, error_code"
      )
      .eq("provider_message_id", providerMessageId.trim())
      .maybeSingle();
    return (data as WhatsAppLogRow | null) ?? null;
  } catch {
    return null;
  }
}

export async function insertWhatsAppNotificationLog(row: {
  sourceTable?: string;
  sourceId?: string;
  template: string;
  status: NotificationLogStatus;
  recipient: string;
  /** Defaults to WhatsApp; SMS senders pass "sms" so Platform → Notifications shows them. */
  channel?: string;
  provider?: string;
  providerMessageId?: string;
  idempotencyKey?: string;
  retryCount?: number;
  nextRetryAt?: string | null;
  errorCode?: string;
  detail?: {
    reason?: string;
    waMeUrl?: string;
    waMeText?: string;
    technical?: string;
    provider?: string;
  };
}): Promise<string | null> {
  const supabase = createAdminSupabase();
  if (!supabase) return null;

  try {
    const { data, error } = await supabase
      .from("notification_log")
      .insert({
        source_table: row.sourceTable ?? null,
        source_id: row.sourceId ?? null,
        template: row.template,
        channel: row.channel ?? "whatsapp",
        status: row.status,
        recipient: row.recipient,
        detail: row.detail ? buildDetail(row.detail) : row.provider ?? null,
        provider: row.provider ?? null,
        provider_message_id: row.providerMessageId ?? null,
        idempotency_key: row.idempotencyKey ?? null,
        retry_count: row.retryCount ?? 0,
        next_retry_at: row.nextRetryAt ?? null,
        error_code: row.errorCode ?? null,
        updated_at: new Date().toISOString(),
      })
      .select("id")
      .maybeSingle();

    if (error) {
      // Unique idempotency race — treat as non-fatal
      console.warn("[whatsapp-log] insert failed:", error.message);
      return null;
    }
    return data?.id ?? null;
  } catch {
    return null;
  }
}

export async function updateWhatsAppNotificationLog(
  id: string,
  patch: {
    status?: NotificationLogStatus;
    provider?: string;
    providerMessageId?: string;
    retryCount?: number;
    nextRetryAt?: string | null;
    errorCode?: string | null;
    deliveredAt?: string | null;
    readAt?: string | null;
    detail?: string | null;
  }
): Promise<void> {
  const supabase = createAdminSupabase();
  if (!supabase || !id) return;

  try {
    await supabase
      .from("notification_log")
      .update({
        ...(patch.status !== undefined ? { status: patch.status } : {}),
        ...(patch.provider !== undefined ? { provider: patch.provider } : {}),
        ...(patch.providerMessageId !== undefined
          ? { provider_message_id: patch.providerMessageId }
          : {}),
        ...(patch.retryCount !== undefined ? { retry_count: patch.retryCount } : {}),
        ...(patch.nextRetryAt !== undefined ? { next_retry_at: patch.nextRetryAt } : {}),
        ...(patch.errorCode !== undefined ? { error_code: patch.errorCode } : {}),
        ...(patch.deliveredAt !== undefined ? { delivered_at: patch.deliveredAt } : {}),
        ...(patch.readAt !== undefined ? { read_at: patch.readAt } : {}),
        ...(patch.detail !== undefined ? { detail: patch.detail } : {}),
        updated_at: new Date().toISOString(),
      })
      .eq("id", id);
  } catch {
    // non-blocking
  }
}

export async function markWhatsAppSendOutcome(params: {
  logId: string | null;
  sent: boolean;
  provider?: string;
  messageId?: string;
  reason?: string;
  errorCode?: string;
  retryable?: boolean;
  deferred?: boolean;
  currentRetryCount?: number;
  waMeUrl?: string;
  waMeText?: string;
}): Promise<void> {
  if (!params.logId) return;

  if (params.sent) {
    await updateWhatsAppNotificationLog(params.logId, {
      status: "sent",
      provider: params.provider,
      providerMessageId: params.messageId,
      nextRetryAt: null,
      errorCode: null,
      detail: params.provider ?? null,
    });
    return;
  }

  if (params.deferred) {
    await updateWhatsAppNotificationLog(params.logId, {
      status: "deferred",
      nextRetryAt: null,
      errorCode: params.errorCode ?? null,
      detail: JSON.stringify({
        reason: params.reason ?? "WhatsApp API not configured",
        waMeUrl: params.waMeUrl,
        waMeText: params.waMeText,
      }),
    });
    return;
  }

  const retryCount = (params.currentRetryCount ?? 0) + (params.retryable ? 1 : 0);
  if (params.retryable && !shouldMarkWhatsAppUndeliverable(retryCount)) {
    await updateWhatsAppNotificationLog(params.logId, {
      status: "failed",
      provider: params.provider,
      retryCount,
      nextRetryAt: computeWhatsAppNextRetryAt(retryCount).toISOString(),
      errorCode: params.errorCode ?? null,
      detail: JSON.stringify({
        reason: params.reason,
        technical: params.reason,
        retryable: true,
        waMeUrl: params.waMeUrl,
        waMeText: params.waMeText,
      }),
    });
    return;
  }

  await updateWhatsAppNotificationLog(params.logId, {
    status: params.retryable ? "undeliverable" : "failed",
    provider: params.provider,
    retryCount: Math.min(retryCount, WHATSAPP_MAX_RETRY_ATTEMPTS),
    nextRetryAt: null,
    errorCode: params.errorCode ?? null,
    detail: JSON.stringify({
      reason: params.reason,
      technical: params.reason,
      waMeUrl: params.waMeUrl,
      waMeText: params.waMeText,
    }),
  });
}

export async function listWhatsAppRetriesDue(limit = 25): Promise<WhatsAppLogRow[]> {
  const supabase = createAdminSupabase();
  if (!supabase) return [];

  const now = new Date().toISOString();
  try {
    const { data } = await supabase
      .from("notification_log")
      .select(
        "id, source_table, source_id, template, channel, status, recipient, detail, provider, provider_message_id, idempotency_key, retry_count, next_retry_at, error_code"
      )
      .eq("channel", "whatsapp")
      .in("status", ["queued", "failed"])
      .not("next_retry_at", "is", null)
      .lte("next_retry_at", now)
      .lt("retry_count", WHATSAPP_MAX_RETRY_ATTEMPTS)
      .order("next_retry_at", { ascending: true })
      .limit(limit);

    return (data as WhatsAppLogRow[] | null) ?? [];
  } catch {
    return [];
  }
}

export async function recordWebhookEventOnce(
  eventId: string,
  eventType?: string,
  payload?: unknown
): Promise<{ inserted: boolean }> {
  const supabase = createAdminSupabase();
  if (!supabase || !eventId.trim()) return { inserted: false };

  try {
    const { error } = await supabase.from("whatsapp_webhook_events").insert({
      event_id: eventId.trim(),
      event_type: eventType ?? null,
      payload: payload ?? null,
    });
    if (error) {
      // unique violation → already processed
      return { inserted: false };
    }
    return { inserted: true };
  } catch {
    return { inserted: false };
  }
}
