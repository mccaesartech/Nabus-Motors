import { NextRequest, NextResponse } from "next/server";
import { verifyCronSecret } from "@/lib/cron/auth";
import { listWhatsAppRetriesDue } from "@/lib/notifications/whatsapp-log";
import { sendWhatsAppMessage } from "@/lib/notifications/whatsapp-send";
import { shouldMarkWhatsAppUndeliverable } from "@/lib/notifications/whatsapp-retry";
import { updateWhatsAppNotificationLog } from "@/lib/notifications/whatsapp-log";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function extractRetryBody(detail: string | null): string {
  if (!detail) return "True Goshen: You have an update. Reply for help.";
  try {
    const parsed = JSON.parse(detail) as { waMeText?: string; reason?: string };
    if (parsed.waMeText?.trim()) return parsed.waMeText.trim();
  } catch {
    // plain detail
  }
  return "True Goshen: You have an update. Reply for help.";
}

async function runRetries(): Promise<{
  attempted: number;
  sent: number;
  failed: number;
  undeliverable: number;
}> {
  const due = await listWhatsAppRetriesDue(25);
  let sent = 0;
  let failed = 0;
  let undeliverable = 0;

  for (const row of due) {
    if (shouldMarkWhatsAppUndeliverable(row.retry_count)) {
      await updateWhatsAppNotificationLog(row.id, {
        status: "undeliverable",
        nextRetryAt: null,
      });
      undeliverable += 1;
      continue;
    }

    const body = extractRetryBody(row.detail);
    const result = await sendWhatsAppMessage(row.recipient, body, {
      logId: row.id,
      template: row.template,
      sourceTable: row.source_table ?? undefined,
      sourceId: row.source_id ?? undefined,
      idempotencyKey: row.idempotency_key ?? undefined,
      currentRetryCount: row.retry_count,
      persistLog: true,
    });

    if (result.sent) {
      sent += 1;
    } else if (result.retryable === false) {
      // markWhatsAppSendOutcome already set failed/undeliverable
      failed += 1;
    } else {
      failed += 1;
    }
  }

  return {
    attempted: due.length,
    sent,
    failed,
    undeliverable,
  };
}

export async function GET(req: NextRequest) {
  if (!verifyCronSecret(req)) {
    return NextResponse.json({ ok: false, message: "Unauthorized" }, { status: 401 });
  }

  const result = await runRetries();
  return NextResponse.json({
    ok: true,
    ...result,
    ranAt: new Date().toISOString(),
  });
}

export async function POST(req: NextRequest) {
  return GET(req);
}
