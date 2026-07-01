import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin/auth";
import {
  CUSTOMER_REPLY_INTENTS,
  generateCustomerReplyDraft,
  type CustomerReplyIntent,
} from "@/lib/ai/customer-reply-ai";
import {
  geminiErrorToHttp,
  getGeminiApiKey,
  getGeminiKeyWarning,
} from "@/lib/ai/gemini";

const WINDOW_MS = 60_000;
const MAX_REQUESTS = 15;
const recentByIp = new Map<string, number[]>();

const VALID_INTENTS = new Set<string>([
  ...CUSTOMER_REPLY_INTENTS.map((i) => i.id),
  "custom",
]);

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const times = (recentByIp.get(ip) ?? []).filter((t) => now - t < WINDOW_MS);
  if (times.length >= MAX_REQUESTS) return true;
  times.push(now);
  recentByIp.set(ip, times);
  return false;
}

export async function POST(req: NextRequest) {
  const auth = await requireAdmin();
  if (!auth.ok) {
    return NextResponse.json({ ok: false }, { status: auth.status });
  }

  const apiKey = getGeminiApiKey();
  if (!apiKey) {
    return NextResponse.json(
      {
        ok: false,
        configured: false,
        message:
          "Add a free Gemini key as GEMINI_API_KEY in Vercel (aistudio.google.com/apikey) to use AI reply assist.",
      },
      { status: 503 }
    );
  }

  const keyWarning = getGeminiKeyWarning();

  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "unknown";

  if (isRateLimited(ip)) {
    return NextResponse.json(
      { ok: false, message: "Too many AI requests. Please wait a minute and try again." },
      { status: 429 }
    );
  }

  let body: {
    customerName?: string;
    email?: string;
    subject?: string;
    body?: string;
    category?: string;
    intent?: string;
    customPrompt?: string;
    existingDraft?: string;
  };

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, message: "Invalid JSON body" }, { status: 400 });
  }

  const intent = String(body.intent ?? "custom");
  if (!VALID_INTENTS.has(intent)) {
    return NextResponse.json({ ok: false, message: "Invalid intent" }, { status: 400 });
  }

  const customerName = String(body.customerName ?? "").trim();
  const subject = String(body.subject ?? "").trim();
  const messageBody = String(body.body ?? "").trim();

  if (!customerName || !subject || !messageBody) {
    return NextResponse.json(
      { ok: false, message: "Customer name, subject, and message body are required." },
      { status: 400 }
    );
  }

  try {
    const draft = await generateCustomerReplyDraft({
      customerName,
      email: String(body.email ?? "").trim(),
      subject,
      body: messageBody,
      category: String(body.category ?? "general"),
      intent: intent as CustomerReplyIntent,
      customPrompt: body.customPrompt,
      existingDraft: body.existingDraft,
    });

    return NextResponse.json({
      ok: true,
      configured: true,
      draft,
      ...(keyWarning ? { keyWarning } : {}),
    });
  } catch (err) {
    const { message, status, code } = geminiErrorToHttp(err);
    const configured = status !== 503 || code !== "INVALID_KEY";
    return NextResponse.json(
      {
        ok: false,
        configured,
        message,
        ...(code ? { code } : {}),
        ...(keyWarning && code === "INVALID_KEY" ? { keyWarning } : {}),
      },
      { status }
    );
  }
}
