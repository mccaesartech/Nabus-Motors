import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/admin/auth";
import type { VehicleInput } from "@/lib/admin/vehicle-fields";
import {
  geminiErrorToHttp,
  generateVehicleSuggestions,
  getGeminiApiKey,
  getGeminiKeyWarning,
} from "@/lib/ai/gemini";

const WINDOW_MS = 60_000;
const MAX_REQUESTS = 12;
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
  const auth = await requirePermission("inventory_edit");
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
          "Add a free Gemini key as GEMINI_API_KEY in Vercel (aistudio.google.com/apikey — AQ. or AIzaSy). Stock photos work without a key.",
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

  let body: { prompt?: string; action?: string; vehicle?: Partial<VehicleInput> };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, message: "Invalid JSON body" }, { status: 400 });
  }

  const prompt = body.prompt?.trim();
  if (!prompt) {
    return NextResponse.json({ ok: false, message: "Missing prompt" }, { status: 400 });
  }

  const action =
    body.action === "improve_description" || body.action === "fill_fields"
      ? body.action
      : "custom";

  try {
    const suggestions = await generateVehicleSuggestions(body.vehicle ?? {}, prompt, action);
    return NextResponse.json({
      ok: true,
      configured: true,
      ...(keyWarning ? { keyWarning } : {}),
      suggestions,
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
