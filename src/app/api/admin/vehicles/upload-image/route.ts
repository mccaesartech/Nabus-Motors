import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/admin/auth";
import { createAdminSupabase } from "@/lib/supabase/admin";

const MAX_BYTES = 5 * 1024 * 1024;
const BUCKET = "vehicle-images";

const ALLOWED_TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

const EXT_TO_MIME: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
};

function resolveImageType(file: File): { mime: string; ext: string } | null {
  const fromMime = ALLOWED_TYPES[file.type];
  if (fromMime) {
    return { mime: file.type === "image/jpg" ? "image/jpeg" : file.type, ext: fromMime };
  }

  const nameExt = file.name.split(".").pop()?.toLowerCase();
  if (nameExt && EXT_TO_MIME[nameExt]) {
    return { mime: EXT_TO_MIME[nameExt], ext: nameExt === "jpeg" ? "jpg" : nameExt };
  }

  return null;
}

export async function POST(req: NextRequest) {
  const auth = await requirePermission("inventory_edit");
  if (!auth.ok) {
    return NextResponse.json({ ok: false }, { status: auth.status });
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

  if (file.size > MAX_BYTES) {
    return NextResponse.json(
      { ok: false, message: "File too large. Maximum size is 5MB." },
      { status: 400 }
    );
  }

  const resolved = resolveImageType(file);
  if (!resolved) {
    return NextResponse.json(
      { ok: false, message: "Invalid file type. Use JPEG, PNG, or WebP." },
      { status: 400 }
    );
  }

  const { mime, ext } = resolved;
  const path = `listings/${Date.now()}-${crypto.randomUUID().slice(0, 8)}.${ext}`;
  const buffer = Buffer.from(await file.arrayBuffer());

  const { error } = await supabase.storage.from(BUCKET).upload(path, buffer, {
    contentType: mime,
    upsert: false,
  });

  if (error) {
    const message = error.message.includes("Bucket not found")
      ? 'Storage bucket "vehicle-images" not found. Run supabase migration 011_vehicle_images_storage.sql or create the bucket in Supabase Dashboard → Storage (public read).'
      : error.message.includes("mime type") || error.message.includes("not allowed")
        ? `Upload rejected by storage: ${error.message}. Allowed types: JPEG, PNG, WebP.`
        : error.message;

    return NextResponse.json({ ok: false, message }, { status: 500 });
  }

  const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(path);

  return NextResponse.json({ ok: true, url: urlData.publicUrl });
}
