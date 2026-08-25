import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { requireWhatsAppAssistAccess } from "@/lib/whatsapp-assist/auth";
import {
  generateWhatsAppSuggestion,
  sanitizeSuggestRequest,
} from "@/lib/whatsapp-assist/suggest";

const WINDOW_MS = 60_000;
const MAX_REQUESTS = 15;
const recentByIp = new Map<string, number[]>();

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const times = (recentByIp.get(ip) ?? []).filter((t) => now - t < WINDOW_MS);
  if (times.length >= MAX_REQUESTS) return true;
  times.push(now);
  recentByIp.set(ip, times);
  return false;
}

export async function POST(req: NextRequest) {
  const auth = await requireWhatsAppAssistAccess();
  if (!auth.ok) {
    return NextResponse.json({ ok: false, message: auth.message }, { status: auth.status });
  }

  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "unknown";

  if (isRateLimited(ip)) {
    return NextResponse.json(
      { ok: false, message: "Too many requests. Please wait a minute and try again." },
      { status: 429 }
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, message: "Invalid JSON body" }, { status: 400 });
  }

  const input = sanitizeSuggestRequest(body);
  if (!input) {
    return NextResponse.json({ ok: false, message: "Phone number is required." }, { status: 400 });
  }

  const supabase = createAdminSupabase();
  if (!supabase) {
    return NextResponse.json({ ok: false, message: "Not configured" }, { status: 503 });
  }

  const outcome = await generateWhatsAppSuggestion(supabase, input, auth.auth);
  if (!outcome.ok) {
    return NextResponse.json(
      { ok: false, configured: outcome.configured, message: outcome.message },
      { status: outcome.status }
    );
  }

  return NextResponse.json({
    ok: true,
    configured: outcome.configured,
    contextSummary: outcome.result.contextSummary,
    followUpReason: outcome.result.followUpReason,
    suggestedMessage: outcome.result.suggestedMessage,
    missingFields: outcome.result.missingFields,
    needsClarification: outcome.result.needsClarification,
    ...(outcome.keyWarning ? { keyWarning: outcome.keyWarning } : {}),
  });
}
