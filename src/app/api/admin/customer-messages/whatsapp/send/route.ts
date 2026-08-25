import { NextRequest, NextResponse } from "next/server";
import { logPlatformActivity } from "@/lib/platform/activity";
import { sendWhatsAppMessage } from "@/lib/notifications/whatsapp-send";
import { whatsappUrl } from "@/lib/constants";
import { toWhatsAppE164 } from "@/lib/notifications/phone";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { requireWhatsAppAssistAccess } from "@/lib/whatsapp-assist/auth";
import { recordStaffWhatsAppSend } from "@/lib/whatsapp-assist/history";
import type { WhatsAppAssistContextType } from "@/lib/whatsapp-assist/types";

function parseSendBody(body: unknown) {
  if (typeof body !== "object" || body === null) return null;
  const record = body as Record<string, unknown>;
  const phone = typeof record.phone === "string" ? record.phone.trim() : "";
  const message = typeof record.message === "string" ? record.message.trim() : "";
  if (!phone || !message) return null;

  const contextType = record.contextType;
  const validContext =
    contextType === "customer" ||
    contextType === "preorder" ||
    contextType === "order" ||
    contextType === "quote" ||
    contextType === "shipment" ||
    contextType === "inquiry";

  return {
    phone,
    message: message.slice(0, 4000),
    customerName: typeof record.customerName === "string" ? record.customerName : undefined,
    customerId: typeof record.customerId === "string" ? record.customerId : undefined,
    userId: typeof record.userId === "string" ? record.userId : undefined,
    email: typeof record.email === "string" ? record.email : undefined,
    contextType: validContext ? (contextType as WhatsAppAssistContextType) : undefined,
    contextId: typeof record.contextId === "string" ? record.contextId : undefined,
  };
}

export async function POST(req: NextRequest) {
  const auth = await requireWhatsAppAssistAccess();
  if (!auth.ok) {
    return NextResponse.json({ ok: false, message: auth.message }, { status: auth.status });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, message: "Invalid JSON body" }, { status: 400 });
  }

  const input = parseSendBody(body);
  if (!input) {
    return NextResponse.json(
      { ok: false, message: "Phone and message are required." },
      { status: 400 }
    );
  }

  const supabase = createAdminSupabase();
  if (!supabase) {
    return NextResponse.json({ ok: false, message: "Not configured" }, { status: 503 });
  }

  const e164 = toWhatsAppE164(input.phone);
  const waMeUrl = e164
    ? whatsappUrl(input.message, e164.replace("+", ""))
    : undefined;

  const sendResult = await sendWhatsAppMessage(input.phone, input.message, {
    template: "staff_manual_outreach",
    sourceTable: "staff_whatsapp_messages",
    persistLog: true,
    preferMetaTemplate: false,
  });

  const method = sendResult.sent ? "api" : "wa_me";
  const historyId = await recordStaffWhatsAppSend(supabase, auth.auth, {
    phone: input.phone,
    body: input.message,
    userId: input.userId ?? null,
    email: input.email ?? null,
    contextType: input.contextType ?? null,
    contextId: input.contextId ?? null,
    sendMethod: method,
    providerMessageId: sendResult.sent ? sendResult.messageId ?? null : null,
  });

  await logPlatformActivity(auth.auth, "whatsapp_outreach_sent", historyId ?? input.phone, {
    customer_phone: input.phone,
    customer_email: input.email,
    send_method: method,
    api_sent: sendResult.sent,
    context_type: input.contextType,
    context_id: input.contextId,
  });

  if (sendResult.sent) {
    return NextResponse.json({
      ok: true,
      method: "api",
      sent: true,
      messageId: sendResult.messageId,
      logId: sendResult.logId ?? historyId,
    });
  }

  return NextResponse.json({
    ok: true,
    method: "wa_me",
    sent: false,
    waMeUrl: sendResult.waMeUrl ?? waMeUrl,
    logId: sendResult.logId ?? historyId,
    reason: sendResult.reason,
  });
}
