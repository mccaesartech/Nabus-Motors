import { NextRequest, NextResponse } from "next/server";
import {
  parseWhatsAppWebhookJson,
  processWhatsAppWebhookPayload,
  verifyMetaWebhookSignature,
} from "@/lib/notifications/whatsapp-webhook";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function verifyToken(): string {
  return process.env.WHATSAPP_VERIFY_TOKEN?.trim() || "";
}

function appSecret(): string {
  return process.env.WHATSAPP_APP_SECRET?.trim() || "";
}

/** Meta webhook verification challenge. */
export async function GET(req: NextRequest) {
  const mode = req.nextUrl.searchParams.get("hub.mode");
  const token = req.nextUrl.searchParams.get("hub.verify_token");
  const challenge = req.nextUrl.searchParams.get("hub.challenge");
  const expected = verifyToken();

  if (mode === "subscribe" && expected && token === expected && challenge) {
    return new NextResponse(challenge, {
      status: 200,
      headers: { "Content-Type": "text/plain" },
    });
  }

  return NextResponse.json({ ok: false, message: "Verification failed" }, { status: 403 });
}

/** Meta delivery status webhooks. Always 200 quickly when signature is valid. */
export async function POST(req: NextRequest) {
  const rawBody = await req.text();
  const signature = req.headers.get("x-hub-signature-256");
  const secret = appSecret();

  if (!secret) {
    console.warn("[whatsapp-webhook] WHATSAPP_APP_SECRET not configured");
    return NextResponse.json({ ok: false }, { status: 503 });
  }

  if (!verifyMetaWebhookSignature(rawBody, signature, secret)) {
    return NextResponse.json({ ok: false, message: "Invalid signature" }, { status: 401 });
  }

  const payload = parseWhatsAppWebhookJson(rawBody);
  if (!payload || payload.object !== "whatsapp_business_account") {
    // Acknowledge unknown but signed payloads quickly.
    return NextResponse.json({ ok: true, ignored: true });
  }

  // Process asynchronously-ish but still within the request — keep work light.
  try {
    const result = await processWhatsAppWebhookPayload(payload);
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    console.warn(
      "[whatsapp-webhook] processing error:",
      error instanceof Error ? error.message : error
    );
    return NextResponse.json({ ok: true, processed: 0, error: true });
  }
}
