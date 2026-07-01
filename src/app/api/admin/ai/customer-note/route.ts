import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/admin/auth";
import {
  CUSTOMER_NOTE_INTENTS,
  generateCustomerNoteDraft,
  type CustomerNoteFieldType,
  type CustomerNoteIntent,
  type CustomerNoteMode,
} from "@/lib/ai/customer-note-ai";
import {
  geminiErrorToHttp,
  getGeminiApiKey,
  getGeminiKeyWarning,
} from "@/lib/ai/gemini";
import { canUseCustomerNoteAi } from "@/lib/platform/permissions";

const WINDOW_MS = 60_000;
const MAX_REQUESTS = 15;
const recentByIp = new Map<string, number[]>();

const VALID_INTENTS = new Set<string>([
  ...CUSTOMER_NOTE_INTENTS.map((i) => i.id),
  "custom",
]);

const VALID_FIELD_TYPES = new Set<string>([
  "shipment_notes",
  "timeline_event",
  "freight_quote_reply",
]);

const VALID_MODES = new Set<string>(["draft", "improve"]);

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const times = (recentByIp.get(ip) ?? []).filter((t) => now - t < WINDOW_MS);
  if (times.length >= MAX_REQUESTS) return true;
  times.push(now);
  recentByIp.set(ip, times);
  return false;
}

export async function POST(req: NextRequest) {
  const auth = await requirePermission("freight");
  if (!auth.ok) {
    return NextResponse.json({ ok: false, message: auth.message }, { status: auth.status });
  }

  if (!canUseCustomerNoteAi(auth.auth.role)) {
    return NextResponse.json(
      {
        ok: false,
        message: "Only owners and managers can use AI note assist.",
      },
      { status: 403 }
    );
  }

  const apiKey = getGeminiApiKey();
  if (!apiKey) {
    return NextResponse.json(
      {
        ok: false,
        configured: false,
        message:
          "Add a free Gemini key as GEMINI_API_KEY in Vercel (aistudio.google.com/apikey) to use AI note assist.",
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

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, message: "Invalid JSON body" }, { status: 400 });
  }

  const fieldType = String(body.fieldType ?? "shipment_notes");
  const mode = String(body.mode ?? "draft");
  const intent = String(body.intent ?? "custom");

  if (!VALID_FIELD_TYPES.has(fieldType)) {
    return NextResponse.json({ ok: false, message: "Invalid field type" }, { status: 400 });
  }
  if (!VALID_MODES.has(mode)) {
    return NextResponse.json({ ok: false, message: "Invalid mode" }, { status: 400 });
  }
  if (!VALID_INTENTS.has(intent)) {
    return NextResponse.json({ ok: false, message: "Invalid intent" }, { status: 400 });
  }

  const bulletPoints = String(body.bulletPoints ?? "").trim();
  const existingDraft = String(body.existingDraft ?? "").trim();

  if (mode === "draft" && !bulletPoints && !existingDraft && intent === "custom") {
    return NextResponse.json(
      {
        ok: false,
        message: "Add rough bullet points or pick a quick intent before drafting.",
      },
      { status: 400 }
    );
  }

  if (mode === "improve" && !existingDraft) {
    return NextResponse.json(
      { ok: false, message: "Add some text to improve first." },
      { status: 400 }
    );
  }

  const timelineEvents = Array.isArray(body.timelineEvents)
    ? body.timelineEvents
        .filter((e): e is Record<string, unknown> => Boolean(e) && typeof e === "object")
        .map((e) => ({
          title: String(e.title ?? ""),
          description: e.description != null ? String(e.description) : null,
          location: e.location != null ? String(e.location) : null,
          event_at: e.event_at != null ? String(e.event_at) : undefined,
        }))
        .filter((e) => e.title)
    : undefined;

  try {
    const draft = await generateCustomerNoteDraft({
      fieldType: fieldType as CustomerNoteFieldType,
      mode: mode as CustomerNoteMode,
      intent: intent as CustomerNoteIntent,
      customPrompt: body.customPrompt != null ? String(body.customPrompt) : undefined,
      existingDraft: existingDraft || undefined,
      bulletPoints: bulletPoints || undefined,
      status: body.status != null ? String(body.status) : undefined,
      customerName: body.customerName != null ? String(body.customerName) : undefined,
      trackingNumber: body.trackingNumber != null ? String(body.trackingNumber) : undefined,
      originCountry: body.originCountry != null ? String(body.originCountry) : undefined,
      destination: body.destination != null ? String(body.destination) : undefined,
      estimatedArrival:
        body.estimatedArrival != null ? String(body.estimatedArrival) : undefined,
      vesselName: body.vesselName != null ? String(body.vesselName) : undefined,
      containerNumber: body.containerNumber != null ? String(body.containerNumber) : undefined,
      eventTitle: body.eventTitle != null ? String(body.eventTitle) : undefined,
      eventLocation: body.eventLocation != null ? String(body.eventLocation) : undefined,
      serviceType: body.serviceType != null ? String(body.serviceType) : undefined,
      cargoDescription:
        body.cargoDescription != null ? String(body.cargoDescription) : undefined,
      customerMessage: body.customerMessage != null ? String(body.customerMessage) : undefined,
      timelineEvents,
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
