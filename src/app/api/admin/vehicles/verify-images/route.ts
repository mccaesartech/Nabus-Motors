import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/admin/auth";
import {
  geminiErrorToHttp,
  getGeminiApiKey,
  getGeminiKeyWarning,
} from "@/lib/ai/gemini";
import { buildVehicleAiLabel, logAiUsage, truncateAiPreview } from "@/lib/ai/usage-log";
import { verifyVehicleImagesMatch } from "@/lib/ai/vehicle-image-match";

const WINDOW_MS = 60_000;
const MAX_REQUESTS = 20;
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
    return NextResponse.json({ ok: false, message: auth.message }, { status: auth.status });
  }

  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "unknown";

  if (isRateLimited(ip)) {
    return NextResponse.json(
      { ok: false, message: "Too many image verification requests. Please wait a minute." },
      { status: 429 }
    );
  }

  let body: {
    images?: string[];
    vehicleId?: string;
    vehicleSlug?: string;
    vehicle?: {
      make?: string;
      model?: string;
      year?: number | string;
      color?: string;
      body_type?: string;
    };
  };

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, message: "Invalid JSON body" }, { status: 400 });
  }

  const images = Array.isArray(body.images)
    ? body.images.filter((url): url is string => typeof url === "string")
    : [];
  const vehicleId =
    typeof body.vehicleId === "string" && body.vehicleId.trim()
      ? body.vehicleId.trim()
      : null;
  const vehicleSlug =
    typeof body.vehicleSlug === "string" && body.vehicleSlug.trim()
      ? body.vehicleSlug.trim()
      : null;
  const vehicleLabel = buildVehicleAiLabel(body.vehicle ?? {});

  try {
    const result = await verifyVehicleImagesMatch(images, body.vehicle ?? {});
    const keyWarning = getGeminiApiKey() ? getGeminiKeyWarning() : null;
    void logAiUsage({
      auth: auth.auth,
      action: "verify_images",
      status: result.blocked || !result.overallMatch ? "partial" : "success",
      vehicleId,
      vehicleSlug,
      vehicleLabel,
      previewSnippet: truncateAiPreview(
        result.summary || `${images.length} photo(s)${vehicleLabel ? ` · ${vehicleLabel}` : ""}`
      ),
      metadata: {
        source: "verify-images",
        imageCount: images.length,
        blocked: result.blocked,
        overallMatch: result.overallMatch,
      },
    });
    return NextResponse.json({
      ...result,
      ok: true,
      ...(keyWarning ? { keyWarning } : {}),
    });
  } catch (err) {
    const { message, status, code } = geminiErrorToHttp(err);
    void logAiUsage({
      auth: auth.auth,
      action: "verify_images",
      status: "error",
      vehicleId,
      vehicleSlug,
      vehicleLabel,
      previewSnippet: `${images.length} photo(s)`,
      errorMessage: message,
      metadata: { source: "verify-images", code: code ?? null },
    });
    return NextResponse.json(
      {
        ok: false,
        configured: status !== 503 || code !== "INVALID_KEY",
        message,
        ...(code ? { code } : {}),
      },
      { status }
    );
  }
}
