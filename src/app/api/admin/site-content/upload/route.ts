import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/admin/auth";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { normalizeMediaUrl } from "@/lib/site-content/media-url";

const IMAGE_MAX_BYTES = 5 * 1024 * 1024;
const VIDEO_MAX_BYTES = 50 * 1024 * 1024;
const BUCKET = "vehicle-images";

const IMAGE_TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

const VIDEO_TYPES: Record<string, string> = {
  "video/mp4": "mp4",
  "video/webm": "webm",
};

const EXT_TO_MIME: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  mp4: "video/mp4",
  webm: "video/webm",
};

type MediaKind = "image" | "video";

function resolveMediaType(
  file: File,
  requestedKind: MediaKind | null
): { kind: MediaKind; mime: string; ext: string } | null {
  const fromImageMime = IMAGE_TYPES[file.type];
  if (fromImageMime) {
    return {
      kind: "image",
      mime: file.type === "image/jpg" ? "image/jpeg" : file.type,
      ext: fromImageMime,
    };
  }

  const fromVideoMime = VIDEO_TYPES[file.type];
  if (fromVideoMime) {
    return { kind: "video", mime: file.type, ext: fromVideoMime };
  }

  const nameExt = file.name.split(".").pop()?.toLowerCase();
  if (nameExt && EXT_TO_MIME[nameExt]) {
    const mime = EXT_TO_MIME[nameExt];
    const kind: MediaKind = mime.startsWith("video/") ? "video" : "image";
    return {
      kind,
      mime,
      ext: nameExt === "jpeg" ? "jpg" : nameExt,
    };
  }

  if (requestedKind === "video") {
    return null;
  }

  return null;
}

export async function POST(req: NextRequest) {
  const auth = await requirePermission("site_content");
  if (!auth.ok) {
    return NextResponse.json({ ok: false, message: auth.message }, { status: auth.status });
  }

  const supabase = createAdminSupabase();
  if (!supabase) {
    return NextResponse.json(
      { ok: false, message: "Supabase not configured. Add SUPABASE_SERVICE_ROLE_KEY." },
      { status: 503 }
    );
  }

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ ok: false, message: "Invalid form data" }, { status: 400 });
  }

  const file = formData.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ ok: false, message: "Missing file" }, { status: 400 });
  }

  const mediaTypeRaw = formData.get("mediaType");
  const requestedKind =
    mediaTypeRaw === "video" ? "video" : mediaTypeRaw === "image" ? "image" : null;

  const resolved = resolveMediaType(file, requestedKind);
  if (!resolved) {
    const message =
      requestedKind === "video"
        ? "Invalid file type. Use MP4 or WebM."
        : "Invalid file type. Use JPEG, PNG, WebP, MP4, or WebM.";
    return NextResponse.json({ ok: false, message }, { status: 400 });
  }

  if (requestedKind === "image" && resolved.kind !== "image") {
    return NextResponse.json(
      { ok: false, message: "Invalid file type. Use JPEG, PNG, or WebP." },
      { status: 400 }
    );
  }

  if (requestedKind === "video" && resolved.kind !== "video") {
    return NextResponse.json(
      { ok: false, message: "Invalid file type. Use MP4 or WebM." },
      { status: 400 }
    );
  }

  const maxBytes = resolved.kind === "video" ? VIDEO_MAX_BYTES : IMAGE_MAX_BYTES;
  if (file.size > maxBytes) {
    const limitMb = resolved.kind === "video" ? 50 : 5;
    return NextResponse.json(
      { ok: false, message: `File too large. Maximum size is ${limitMb}MB.` },
      { status: 400 }
    );
  }

  const { mime, ext, kind } = resolved;
  const folder = kind === "video" ? "site-content/videos" : "site-content";
  const path = `${folder}/${Date.now()}-${crypto.randomUUID().slice(0, 8)}.${ext}`;
  const buffer = Buffer.from(await file.arrayBuffer());

  const { error } = await supabase.storage.from(BUCKET).upload(path, buffer, {
    contentType: mime,
    upsert: false,
  });

  if (error) {
    const message = error.message.includes("Bucket not found")
      ? 'Storage bucket "vehicle-images" not found. Run supabase migration 011_vehicle_images_storage.sql.'
      : error.message.includes("mime type") || error.message.includes("file size")
        ? `${error.message} Run migration 016_site_content_videos_storage.sql to allow video uploads.`
        : error.message;

    return NextResponse.json({ ok: false, message }, { status: 500 });
  }

  const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(path);

  return NextResponse.json({
    ok: true,
    url: normalizeMediaUrl(urlData.publicUrl),
    kind,
  });
}
