import { NextRequest, NextResponse } from "next/server";
import { getCustomerFromAuthHeader } from "@/lib/customer/auth";
import { resolveCustomerAvatarUrl } from "@/lib/customer/profile";
import { customerAvatarStoragePath } from "@/lib/security/avatar-path";
import { mediaBytesMatchMime } from "@/lib/security/media-signature";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { enqueueAuditLog } from "@/lib/audit/write";

const MAX_BYTES = 2 * 1024 * 1024;
const BUCKET = "customer-avatars";

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
    return {
      mime: file.type === "image/jpg" ? "image/jpeg" : file.type,
      ext: fromMime,
    };
  }

  const nameExt = file.name.split(".").pop()?.toLowerCase();
  if (nameExt && EXT_TO_MIME[nameExt]) {
    return {
      mime: EXT_TO_MIME[nameExt],
      ext: nameExt === "jpeg" ? "jpg" : nameExt,
    };
  }

  return null;
}

async function removeExistingAvatars(
  supabase: NonNullable<ReturnType<typeof createAdminSupabase>>,
  userId: string
): Promise<void> {
  const { data: listed } = await supabase.storage.from(BUCKET).list(userId);
  if (!listed?.length) return;
  const paths = listed.map((item) => `${userId}/${item.name}`);
  await supabase.storage.from(BUCKET).remove(paths);
}

export async function POST(req: NextRequest) {
  const user = await getCustomerFromAuthHeader(req.headers.get("authorization"));
  if (!user) {
    return NextResponse.json({ ok: false, message: "Unauthorized" }, { status: 401 });
  }

  const supabase = createAdminSupabase();
  if (!supabase) {
    return NextResponse.json(
      { ok: false, message: "Photo upload is not available right now." },
      { status: 503 }
    );
  }

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ ok: false, message: "Invalid form data." }, { status: 400 });
  }

  const file = formData.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ ok: false, message: "Choose a photo to upload." }, { status: 400 });
  }

  if (file.size > MAX_BYTES) {
    return NextResponse.json(
      { ok: false, message: "Photo is too large. Maximum size is 2MB." },
      { status: 400 }
    );
  }

  const resolved = resolveImageType(file);
  if (!resolved) {
    return NextResponse.json(
      { ok: false, message: "Use a JPEG, PNG, or WebP image." },
      { status: 400 }
    );
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  if (!mediaBytesMatchMime(buffer, resolved.mime)) {
    return NextResponse.json(
      { ok: false, message: "File content does not match the declared image type." },
      { status: 400 }
    );
  }

  await removeExistingAvatars(supabase, user.id);

  let path: string;
  try {
    path = customerAvatarStoragePath(user.id, resolved.ext);
  } catch {
    return NextResponse.json(
      { ok: false, message: "Could not store this photo." },
      { status: 400 }
    );
  }
  const { error: uploadError } = await supabase.storage.from(BUCKET).upload(path, buffer, {
    contentType: resolved.mime,
    cacheControl: "3600",
    upsert: true,
  });

  if (uploadError) {
    const message = uploadError.message.includes("Bucket not found")
      ? 'Storage bucket "customer-avatars" not found. Run migration 091 or create the bucket in Supabase Dashboard → Storage.'
      : "Could not upload your photo. Try a different image.";
    return NextResponse.json({ ok: false, message }, { status: 500 });
  }

  const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(path);
  // Cache-bust so browsers pick up replacements at the same path.
  const publicUrl = `${urlData.publicUrl}?v=${Date.now()}`;

  const { data: updated, error: updateError } = await supabase
    .from("profiles")
    .update({
      avatar_url: publicUrl,
      updated_at: new Date().toISOString(),
    })
    .eq("id", user.id)
    .select("avatar_url")
    .maybeSingle();

  if (updateError || !updated) {
    return NextResponse.json(
      {
        ok: false,
        message: updateError?.message?.includes("avatar_url")
          ? "Avatar column is missing. Run migration 091_customer_profile_enrichment.sql."
          : "Photo uploaded but profile could not be updated.",
      },
      { status: 500 }
    );
  }

  enqueueAuditLog({
    action: "file_upload",
    success: true,
    actorUserId: user.id,
    actorName: user.email ?? null,
    actorRole: "customer",
    targetType: "avatar",
    targetId: user.id,
    metadata: { mime: resolved.mime },
    request: req,
  });

  return NextResponse.json({
    ok: true,
    avatar_url: updated.avatar_url,
    message: "Profile photo updated.",
  });
}

export async function DELETE(req: NextRequest) {
  const user = await getCustomerFromAuthHeader(req.headers.get("authorization"));
  if (!user) {
    return NextResponse.json({ ok: false, message: "Unauthorized" }, { status: 401 });
  }

  const supabase = createAdminSupabase();
  if (!supabase) {
    return NextResponse.json(
      { ok: false, message: "Photo removal is not available right now." },
      { status: 503 }
    );
  }

  await removeExistingAvatars(supabase, user.id);

  const { error: updateError } = await supabase
    .from("profiles")
    .update({
      avatar_url: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", user.id);

  if (updateError) {
    return NextResponse.json(
      { ok: false, message: "Could not remove your profile photo." },
      { status: 500 }
    );
  }

  enqueueAuditLog({
    action: "file_delete",
    success: true,
    actorUserId: user.id,
    actorName: user.email ?? null,
    actorRole: "customer",
    targetType: "avatar",
    targetId: user.id,
    request: req,
  });

  const oauthFallback = resolveCustomerAvatarUrl({
    profileAvatarUrl: null,
    userMetadata: user.user_metadata as Record<string, unknown>,
  });

  return NextResponse.json({
    ok: true,
    avatar_url: oauthFallback,
    message: oauthFallback
      ? "Custom photo removed. Your Google photo is shown again."
      : "Profile photo removed.",
  });
}
