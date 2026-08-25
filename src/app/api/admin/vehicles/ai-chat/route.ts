import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/admin/auth";
import { galleryFromInput } from "@/lib/admin/vehicle-fields";
import { geminiErrorToHttp, getGeminiApiKey, getGeminiKeyWarning } from "@/lib/ai/gemini";
import { fetchUrlsAsGeminiInlineImages } from "@/lib/ai/gemini-vision-images";
import { isPhotoRequest } from "@/lib/ai/photo-request";
import {
  buildVehicleAiLabel,
  inferAiChatAction,
  logAiUsage,
} from "@/lib/ai/usage-log";
import {
  generateStockPhotoSuggestions,
  generateVehicleAiChatReply,
} from "@/lib/ai/vehicle-ai-chat";
import type {
  VehicleAiChatMessage,
  VehicleAiChatVehicleState,
} from "@/lib/ai/vehicle-ai-chat-types";
import {
  collectVisionImageUrls,
  isFillFromPhotosRequest,
} from "@/lib/ai/vehicle-ai-vision";

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

function isChatMessage(value: unknown): value is VehicleAiChatMessage {
  if (typeof value !== "object" || value === null) return false;
  const m = value as Record<string, unknown>;
  return (
    (m.role === "user" || m.role === "assistant") &&
    typeof m.content === "string" &&
    m.content.trim().length > 0
  );
}

export async function POST(req: NextRequest) {
  const auth = await requirePermission("inventory_edit");
  if (!auth.ok) {
    return NextResponse.json({ ok: false }, { status: auth.status });
  }

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
    messages?: unknown;
    currentVehicle?: VehicleAiChatVehicleState;
    vehicleId?: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, message: "Invalid JSON body" }, { status: 400 });
  }

  const vehicleId =
    typeof body.vehicleId === "string" && body.vehicleId.trim()
      ? body.vehicleId.trim()
      : null;

  const rawMessages = body.messages;
  if (!Array.isArray(rawMessages) || rawMessages.length === 0) {
    return NextResponse.json({ ok: false, message: "Missing messages" }, { status: 400 });
  }

  const messages = rawMessages.filter(isChatMessage).map((m) => ({
    role: m.role,
    content: m.content.trim().slice(0, 8000),
  }));

  if (!messages.length || messages[messages.length - 1]?.role !== "user") {
    return NextResponse.json(
      { ok: false, message: "Last message must be from the user" },
      { status: 400 }
    );
  }

  const vehicle = body.currentVehicle;
  if (!vehicle || typeof vehicle !== "object") {
    return NextResponse.json({ ok: false, message: "Missing currentVehicle" }, { status: 400 });
  }

  const currentVehicle: VehicleAiChatVehicleState = {
    make: String(vehicle.make ?? ""),
    model: String(vehicle.model ?? ""),
    year: Number(vehicle.year) || new Date().getFullYear(),
    trim: vehicle.trim ? String(vehicle.trim) : "",
    price: Number(vehicle.price) || 0,
    mileage: Number(vehicle.mileage) || 0,
    fuel_type: String(vehicle.fuel_type ?? "Petrol"),
    transmission: String(vehicle.transmission ?? "Automatic"),
    condition: String(vehicle.condition ?? "Used"),
    body_type: String(vehicle.body_type ?? "SUV"),
    location: String(vehicle.location ?? ""),
    engine_size: vehicle.engine_size ? String(vehicle.engine_size) : "",
    color: vehicle.color ? String(vehicle.color) : "",
    vin: vehicle.vin ? String(vehicle.vin) : "",
    description: vehicle.description ? String(vehicle.description) : "",
    featured: Boolean(vehicle.featured),
    status: String(vehicle.status ?? "available"),
    images: Array.isArray(vehicle.images) ? vehicle.images.map(String) : [],
    gallery: galleryFromInput(vehicle.gallery, vehicle.images),
    slug: vehicle.slug ? String(vehicle.slug) : undefined,
    inspection_summary: vehicle.inspection_summary
      ? String(vehicle.inspection_summary)
      : "",
    warranty_notes: vehicle.warranty_notes ? String(vehicle.warranty_notes) : "",
    drivetrain: vehicle.drivetrain ? String(vehicle.drivetrain) : "",
    horsepower: vehicle.horsepower ? String(vehicle.horsepower) : "",
    range: vehicle.range ? String(vehicle.range) : "",
    seating_capacity:
      vehicle.seating_capacity != null && Number.isFinite(Number(vehicle.seating_capacity))
        ? Number(vehicle.seating_capacity)
        : null,
  };

  const lastUserMessage = messages[messages.length - 1]?.content ?? "";
  const fillFromPhotos = isFillFromPhotosRequest(lastUserMessage);
  const photoOnly = isPhotoRequest(lastUserMessage) && !fillFromPhotos;
  const vehicleLabel = buildVehicleAiLabel(currentVehicle);
  const vehicleSlug = currentVehicle.slug ?? null;
  const inferredAction = photoOnly
    ? ("suggest_photos" as const)
    : inferAiChatAction(lastUserMessage);

  // Stock photos use the local Pexels URL pool — free, no Gemini key or quota.
  if (photoOnly) {
    const result = generateStockPhotoSuggestions(currentVehicle);
    void logAiUsage({
      auth: auth.auth,
      action: "suggest_photos",
      status: "success",
      vehicleId,
      vehicleSlug,
      vehicleLabel,
      previewSnippet: lastUserMessage,
      metadata: { source: "ai-chat", photoOnly: true },
    });
    return NextResponse.json({
      ok: true,
      configured: Boolean(getGeminiApiKey()),
      ...result,
    });
  }

  const apiKey = getGeminiApiKey();
  if (!apiKey) {
    void logAiUsage({
      auth: auth.auth,
      action: inferredAction,
      status: "error",
      vehicleId,
      vehicleSlug,
      vehicleLabel,
      previewSnippet: lastUserMessage,
      errorMessage: "GEMINI_API_KEY not configured",
      metadata: { source: "ai-chat", configured: false },
    });
    return NextResponse.json(
      {
        ok: false,
        configured: false,
        message:
          "Add GEMINI_API_KEY in Vercel for photo analysis and text edits (aistudio.google.com/apikey). Stock photos, paste/drop uploads, and color filters work without a key.",
      },
      { status: 503 }
    );
  }

  const keyWarning = getGeminiKeyWarning();

  try {
    const visionUrls = collectVisionImageUrls(
      currentVehicle.gallery,
      currentVehicle.images
    );
    const visionImages = visionUrls.length
      ? await fetchUrlsAsGeminiInlineImages(visionUrls)
      : [];

    const result = await generateVehicleAiChatReply(messages, currentVehicle, {
      visionImages,
    });
    const visionFetchFailed = visionUrls.length > 0 && visionImages.length === 0;
    void logAiUsage({
      auth: auth.auth,
      action: inferredAction,
      status: visionFetchFailed ? "partial" : "success",
      vehicleId,
      vehicleSlug,
      vehicleLabel,
      previewSnippet: result.reply ?? lastUserMessage,
      metadata: {
        source: "ai-chat",
        fillFromPhotos,
        visionImagesAttached: visionImages.length,
        visionUrlsAttempted: visionUrls.length,
        visionFetchFailed,
        hasChanges: Boolean(result.changes),
      },
    });
    return NextResponse.json({
      ok: true,
      configured: true,
      ...(keyWarning ? { keyWarning } : {}),
      visionImagesAttached: visionImages.length,
      visionUrlsAttempted: visionUrls.length,
      visionFetchFailed,
      ...result,
    });
  } catch (err) {
    const { message, status, code } = geminiErrorToHttp(err);
    const configured = status !== 503 || code !== "INVALID_KEY";
    const quotaHint =
      code === "QUOTA_EXCEEDED"
        ? " Text editing is paused until quota resets. Stock photos still work — use “Find stock photos (free)”."
        : "";
    void logAiUsage({
      auth: auth.auth,
      action: inferredAction,
      status: "error",
      vehicleId,
      vehicleSlug,
      vehicleLabel,
      previewSnippet: lastUserMessage,
      errorMessage: message,
      metadata: { source: "ai-chat", code: code ?? null },
    });
    return NextResponse.json(
      {
        ok: false,
        configured,
        message: `${message}${quotaHint}`,
        ...(code ? { code } : {}),
        ...(keyWarning && code === "INVALID_KEY" ? { keyWarning } : {}),
      },
      { status }
    );
  }
}
