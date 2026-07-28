import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/admin/auth";
import { logPlatformActivity } from "@/lib/platform/activity";
import { sendWhatsAppMessage } from "@/lib/notifications/whatsapp-send";
import { getWhatsAppConfig } from "@/lib/notifications/whatsapp-config";
import { consumeRateLimit, requestIp } from "@/lib/security/rate-limit";
import { toWhatsAppE164 } from "@/lib/notifications/phone";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const auth = await requirePermission("settings");
  if (!auth.ok) {
    return NextResponse.json({ ok: false, message: auth.message }, { status: auth.status });
  }

  const rate = consumeRateLimit("admin-whatsapp-test", `${auth.auth.userId ?? requestIp(req.headers)}`, {
    limit: 5,
    windowMs: 15 * 60_000,
  });
  if (!rate.allowed) {
    return NextResponse.json(
      { ok: false, message: "Too many test sends. Try again later." },
      {
        status: 429,
        headers: { "Retry-After": String(rate.retryAfterSeconds) },
      }
    );
  }

  let body: { phone?: string; message?: string };
  try {
    body = (await req.json()) as { phone?: string; message?: string };
  } catch {
    return NextResponse.json({ ok: false, message: "Invalid JSON body." }, { status: 400 });
  }

  const phone = String(body.phone ?? "").trim();
  const message =
    String(body.message ?? "").trim() ||
    "True Goshen: WhatsApp API test message. Configuration looks good.";

  if (!phone || !toWhatsAppE164(phone)) {
    return NextResponse.json({ ok: false, message: "Enter a valid phone number." }, { status: 400 });
  }

  const config = await getWhatsAppConfig();
  const result = await sendWhatsAppMessage(phone, message, {
    template: "whatsapp_test",
    sourceTable: "site_settings",
    sourceId: "whatsapp_test",
    persistLog: true,
    idempotencyKey: `whatsapp_test:${auth.auth.userId ?? "admin"}:${Date.now()}`,
  });

  await logPlatformActivity(auth.auth, "settings_updated", "whatsapp_test", {
    action: "whatsapp_test_send",
    provider: config.provider || null,
    source: config.source,
    sent: result.sent,
    ...(result.sent
      ? { message_id: result.messageId ?? null }
      : { reason: result.reason.slice(0, 120) }),
  });

  if (!result.sent) {
    return NextResponse.json({
      ok: false,
      message: result.reason,
      provider: config.provider || null,
      source: config.source,
      enabled: config.enabled,
      configured: config.configured,
    });
  }

  return NextResponse.json({
    ok: true,
    message: "Test WhatsApp message sent.",
    provider: result.provider,
    messageId: result.messageId ?? null,
    source: config.source,
  });
}
