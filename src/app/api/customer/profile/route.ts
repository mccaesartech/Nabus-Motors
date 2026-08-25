import { NextRequest, NextResponse } from "next/server";
import { getCustomerFromAuthHeader } from "@/lib/customer/auth";
import {
  customerAuthProviderLabel,
  formatMemberSince,
  mergeProfileUpdate,
  resolveCustomerAvatarUrl,
  type PreferredContact,
} from "@/lib/customer/profile";
import { ensureProfileRegistrationId } from "@/lib/customer/registration-id";
import { createAdminSupabase } from "@/lib/supabase/admin";

const PROFILE_SELECT =
  "id, first_name, last_name, phone, email, registration_id, avatar_url, address_line, city, country, preferred_contact, created_at, whatsapp_opt_in";

function serializeProfile(
  user: { id: string; email?: string | null; user_metadata?: unknown; app_metadata?: Record<string, unknown> | null; identities?: Array<{ provider?: string }> | null },
  data: {
    first_name?: string | null;
    last_name?: string | null;
    phone?: string | null;
    email?: string | null;
    registration_id?: string | null;
    avatar_url?: string | null;
    address_line?: string | null;
    city?: string | null;
    country?: string | null;
    preferred_contact?: string | null;
    created_at?: string | null;
  } | null
) {
  const preferred =
    data?.preferred_contact === "email" ||
    data?.preferred_contact === "phone" ||
    data?.preferred_contact === "whatsapp"
      ? (data.preferred_contact as PreferredContact)
      : null;

  return {
    id: user.id,
    first_name: data?.first_name ?? null,
    last_name: data?.last_name ?? null,
    phone: data?.phone ?? null,
    email: data?.email ?? user.email ?? null,
    registration_id: data?.registration_id ?? null,
    avatar_url: resolveCustomerAvatarUrl({
      profileAvatarUrl: data?.avatar_url,
      userMetadata: user.user_metadata as Record<string, unknown>,
    }),
    uploaded_avatar_url: data?.avatar_url ?? null,
    address_line: data?.address_line ?? null,
    city: data?.city ?? null,
    country: data?.country ?? null,
    preferred_contact: preferred,
    created_at: data?.created_at ?? null,
    member_since: formatMemberSince(data?.created_at),
    auth_provider: customerAuthProviderLabel(user),
  };
}

export async function GET(req: NextRequest) {
  const user = await getCustomerFromAuthHeader(req.headers.get("authorization"));
  if (!user) {
    return NextResponse.json({ ok: false, message: "Unauthorized" }, { status: 401 });
  }

  const supabase = createAdminSupabase();
  if (!supabase) {
    return NextResponse.json(
      { ok: false, message: "Profile is not available right now." },
      { status: 503 }
    );
  }

  let { data, error } = await supabase
    .from("profiles")
    .select(PROFILE_SELECT)
    .eq("id", user.id)
    .maybeSingle();

  if (error) {
    // Older DBs may not have enrichment columns yet — fall back to core fields.
    const fallback = await supabase
      .from("profiles")
      .select("id, first_name, last_name, phone, email, registration_id, created_at")
      .eq("id", user.id)
      .maybeSingle();
    if (fallback.error) {
      return NextResponse.json(
        { ok: false, message: "Could not load your profile." },
        { status: 500 }
      );
    }
    data = fallback.data as typeof data;
    error = null;
  }

  if (data && !data.registration_id?.trim()) {
    const registrationId = await ensureProfileRegistrationId(supabase, user.id);
    if (registrationId) {
      data = { ...data, registration_id: registrationId };
    }
  }

  return NextResponse.json({
    ok: true,
    profile: serializeProfile(user, data),
  });
}

export async function PATCH(req: NextRequest) {
  const user = await getCustomerFromAuthHeader(req.headers.get("authorization"));
  if (!user) {
    return NextResponse.json({ ok: false, message: "Unauthorized" }, { status: 401 });
  }

  const supabase = createAdminSupabase();
  if (!supabase) {
    return NextResponse.json(
      { ok: false, message: "Profile updates are not available right now." },
      { status: 503 }
    );
  }

  let body: Record<string, unknown> = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { ok: false, message: "Invalid request body." },
      { status: 400 }
    );
  }

  const { data: existing, error: readError } = await supabase
    .from("profiles")
    .select(PROFILE_SELECT)
    .eq("id", user.id)
    .maybeSingle();

  if (readError) {
    return NextResponse.json(
      { ok: false, message: "Could not load your profile." },
      { status: 500 }
    );
  }

  if (!existing) {
    return NextResponse.json(
      { ok: false, message: "Profile not found. Refresh and try again." },
      { status: 404 }
    );
  }

  const merged = mergeProfileUpdate(
    {
      first_name: existing.first_name ?? null,
      last_name: existing.last_name ?? null,
      phone: existing.phone ?? null,
      address_line: existing.address_line ?? null,
      city: existing.city ?? null,
      country: existing.country ?? null,
      preferred_contact:
        existing.preferred_contact === "email" ||
        existing.preferred_contact === "phone" ||
        existing.preferred_contact === "whatsapp"
          ? existing.preferred_contact
          : null,
    },
    {
      firstName: body.firstName,
      lastName: body.lastName,
      phone: body.phone,
      addressLine: body.addressLine,
      city: body.city,
      country: body.country,
      preferredContact: body.preferredContact,
    }
  );

  if (!merged.ok) {
    return NextResponse.json({ ok: false, message: merged.message }, { status: 400 });
  }

  const { data: updated, error: updateError } = await supabase
    .from("profiles")
    .update({
      first_name: merged.next.first_name,
      last_name: merged.next.last_name,
      phone: merged.next.phone,
      address_line: merged.next.address_line,
      city: merged.next.city,
      country: merged.next.country,
      preferred_contact: merged.next.preferred_contact,
      updated_at: new Date().toISOString(),
    })
    .eq("id", user.id)
    .select(PROFILE_SELECT)
    .maybeSingle();

  if (updateError || !updated) {
    const message = updateError?.message?.includes("preferred_contact")
      ? "Preferred contact could not be saved. Run the latest database migration."
      : updateError?.message?.includes("address_line") ||
          updateError?.message?.includes("city") ||
          updateError?.message?.includes("country")
        ? "Address fields are not available yet. Run the latest database migration."
        : "Could not save your profile.";
    return NextResponse.json({ ok: false, message }, { status: 500 });
  }

  if (!updated.registration_id?.trim()) {
    const registrationId = await ensureProfileRegistrationId(supabase, user.id);
    if (registrationId) {
      updated.registration_id = registrationId;
    }
  }

  // Keep auth metadata in sync so display-name fallbacks stay consistent.
  try {
    const fullName = [updated.first_name, updated.last_name]
      .filter(Boolean)
      .join(" ")
      .trim();
    await supabase.auth.admin.updateUserById(user.id, {
      user_metadata: {
        ...(user.user_metadata ?? {}),
        full_name: fullName || undefined,
        phone: updated.phone ?? undefined,
      },
    });
  } catch {
    // Non-blocking — profiles row is source of truth in the app.
  }

  return NextResponse.json({
    ok: true,
    profile: serializeProfile(user, updated),
    message: "Profile updated.",
  });
}
