import { NextRequest, NextResponse } from "next/server";
import { dbFailure } from "@/lib/errors/api";
import sharp from "sharp";
import { requirePermission } from "@/lib/admin/auth";
import {
  type ImageAdjustPreset,
  isImageAdjustPreset,
} from "@/lib/ai/image-adjustments";
import { enhanceListingImageTo4k } from "@/lib/images/enhance-upload";
import { createAdminSupabase } from "@/lib/supabase/admin";

const BUCKET = "vehicle-images";
const MAX_BYTES = 8 * 1024 * 1024;

async function applyPreset(buffer: Buffer, preset: ImageAdjustPreset): Promise<Buffer> {
  if (preset === "enhance") {
    const result = await enhanceListingImageTo4k(buffer, "image/jpeg");
    if (!result.enhanced) {
      throw new Error("Enhance pipeline returned original");
    }
    return Buffer.from(result.buffer);
  }

  const base = sharp(buffer).rotate();

  switch (preset) {
    case "brighten":
      return base.modulate({ brightness: 1.25 }).jpeg({ quality: 90 }).toBuffer();
    case "darken":
      return base.modulate({ brightness: 0.75 }).jpeg({ quality: 90 }).toBuffer();
    case "contrast":
      return base
        .normalise({ lower: 5, upper: 95 })
        .linear(1.25, -24)
        .jpeg({ quality: 90 })
        .toBuffer();
    case "vibrant":
      return base.modulate({ saturation: 1.45 }).jpeg({ quality: 90 }).toBuffer();
    case "muted":
      return base.modulate({ saturation: 0.65 }).jpeg({ quality: 90 }).toBuffer();
    case "warm":
      return base
        .modulate({ brightness: 1.05, saturation: 1.12 })
        .tint({ r: 255, g: 238, b: 215 })
        .jpeg({ quality: 90 })
        .toBuffer();
    case "cool":
      return base
        .modulate({ brightness: 1.02, saturation: 1.05 })
        .tint({ r: 215, g: 232, b: 255 })
        .jpeg({ quality: 90 })
        .toBuffer();
    default:
      return base.jpeg({ quality: 90 }).toBuffer();
  }
}

function isAllowedImageUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return false;
    const host = parsed.hostname.toLowerCase();
    if (host.includes("supabase")) return true;
    if (host.includes("pexels.com")) return true;
    if (host.includes("unsplash.com")) return true;
    return false;
  } catch {
    return false;
  }
}

export async function POST(req: NextRequest) {
  const auth = await requirePermission("inventory_edit");
  if (!auth.ok) {
    return NextResponse.json({ ok: false }, { status: auth.status });
  }

  const supabase = createAdminSupabase();
  if (!supabase) {
    return NextResponse.json(
      { ok: false, message: "Supabase not configured." },
      { status: 503 }
    );
  }

  let body: { url?: string; preset?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, message: "Invalid JSON body" }, { status: 400 });
  }

  const sourceUrl = body.url?.trim();
  const preset = body.preset?.trim();

  if (!sourceUrl) {
    return NextResponse.json({ ok: false, message: "Missing image url" }, { status: 400 });
  }

  if (!preset || !isImageAdjustPreset(preset)) {
    return NextResponse.json(
      {
        ok: false,
        message:
          "Invalid preset. Use warm, cool, brighten, darken, contrast, vibrant, muted, or enhance.",
      },
      { status: 400 }
    );
  }

  if (!isAllowedImageUrl(sourceUrl)) {
    return NextResponse.json(
      { ok: false, message: "Only gallery or storage URLs can be edited." },
      { status: 400 }
    );
  }

  let imageBuffer: Buffer;
  try {
    const res = await fetch(sourceUrl, { signal: AbortSignal.timeout(15_000) });
    if (!res.ok) {
      return NextResponse.json(
        { ok: false, message: "Could not download the image." },
        { status: 400 }
      );
    }
    imageBuffer = Buffer.from(await res.arrayBuffer());
    if (imageBuffer.length > MAX_BYTES) {
      return NextResponse.json(
        { ok: false, message: "Image too large to edit (max 8MB)." },
        { status: 400 }
      );
    }
  } catch {
    return NextResponse.json(
      { ok: false, message: "Could not download the image." },
      { status: 400 }
    );
  }

  let edited: Buffer;
  try {
    edited = await applyPreset(imageBuffer, preset);
  } catch {
    return NextResponse.json(
      { ok: false, message: "Could not process the image." },
      { status: 500 }
    );
  }

  // Small inline preview so the chat UI can show After immediately without
  // waiting on CDN/storage propagation of a freshly uploaded object.
  let previewDataUrl: string | undefined;
  try {
    const preview = await sharp(edited)
      .resize(160, 160, { fit: "cover" })
      .jpeg({ quality: 72 })
      .toBuffer();
    previewDataUrl = `data:image/jpeg;base64,${preview.toString("base64")}`;
  } catch {
    previewDataUrl = undefined;
  }

  const path = `listings/edited/${Date.now()}-${crypto.randomUUID().slice(0, 8)}.jpg`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, edited, {
    contentType: "image/jpeg",
    cacheControl: "31536000",
    upsert: false,
  });

  if (error) {
    return dbFailure(error, {
      module: "api.admin.vehicles.edit-image.POST",
      message: "The image could not be edited. Try again.",
      request: req,
    });
  }

  const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(path);

  return NextResponse.json({
    ok: true,
    url: urlData.publicUrl,
    previewDataUrl,
    sourceUrl,
    preset,
  });
}
