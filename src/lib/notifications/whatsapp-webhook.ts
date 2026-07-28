import "server-only";
import {
  findNotificationByProviderMessageId,
  recordWebhookEventOnce,
  updateWhatsAppNotificationLog,
} from "@/lib/notifications/whatsapp-log";
import {
  mapMetaWebhookStatus,
  verifyMetaWebhookSignature,
} from "@/lib/notifications/whatsapp-meta";

export { verifyMetaWebhookSignature, mapMetaWebhookStatus };

type MetaStatusUpdate = {
  id?: string;
  status?: string;
  timestamp?: string;
  errors?: Array<{ code?: number; title?: string; message?: string }>;
};

type MetaWebhookPayload = {
  object?: string;
  entry?: Array<{
    id?: string;
    changes?: Array<{
      field?: string;
      value?: {
        statuses?: MetaStatusUpdate[];
        messages?: Array<{ id?: string }>;
      };
    }>;
  }>;
};

function buildEventId(status: MetaStatusUpdate, entryId?: string): string {
  const messageId = status.id ?? "unknown";
  const statusName = status.status ?? "unknown";
  const ts = status.timestamp ?? "0";
  return `meta:${entryId ?? "entry"}:${messageId}:${statusName}:${ts}`;
}

export async function processWhatsAppWebhookPayload(
  payload: MetaWebhookPayload
): Promise<{ processed: number; skipped: number }> {
  let processed = 0;
  let skipped = 0;

  for (const entry of payload.entry ?? []) {
    for (const change of entry.changes ?? []) {
      const statuses = change.value?.statuses ?? [];
      for (const status of statuses) {
        const eventId = buildEventId(status, entry.id);
        const { inserted } = await recordWebhookEventOnce(eventId, status.status, status);
        if (!inserted) {
          skipped += 1;
          continue;
        }

        const mapped = mapMetaWebhookStatus(status.status);
        if (!mapped || !status.id) {
          skipped += 1;
          continue;
        }

        const row = await findNotificationByProviderMessageId(status.id);
        if (!row) {
          skipped += 1;
          continue;
        }

        const now = new Date().toISOString();
        const errorCode =
          status.errors?.[0]?.code != null ? String(status.errors[0].code) : null;

        await updateWhatsAppNotificationLog(row.id, {
          status: mapped,
          errorCode,
          deliveredAt: mapped === "delivered" || mapped === "read" ? now : undefined,
          readAt: mapped === "read" ? now : undefined,
          detail:
            mapped === "failed" || mapped === "undeliverable"
              ? JSON.stringify({
                  reason: status.errors?.[0]?.title ?? status.errors?.[0]?.message ?? mapped,
                  webhookStatus: status.status,
                })
              : undefined,
        });
        processed += 1;
      }
    }
  }

  return { processed, skipped };
}

export function parseWhatsAppWebhookJson(rawBody: string): MetaWebhookPayload | null {
  try {
    return JSON.parse(rawBody) as MetaWebhookPayload;
  } catch {
    return null;
  }
}
