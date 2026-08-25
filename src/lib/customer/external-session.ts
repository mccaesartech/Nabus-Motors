import "server-only";

import { randomUUID } from "crypto";
import { createAdminSupabase } from "@/lib/supabase/admin";
import {
  getAuthServiceUrl,
  type ExternalAuthSession,
  type ExternalAuthUser,
} from "@/lib/customer/external-auth";
import { ensureProfileRegistrationId } from "@/lib/customer/registration-id";

function normalizedUser(payload: unknown): ExternalAuthUser | null {
  if (!payload || typeof payload !== "object") return null;
  const value = payload as Record<string, unknown>;
  const email = typeof value.email === "string" ? value.email.trim().toLowerCase() : "";
  const id = typeof value.id === "string" ? value.id.trim() : "";
  if (!id || !email) return null;
  return {
    id,
    email,
    name: typeof value.name === "string" ? value.name : null,
    image: typeof value.image === "string" ? value.image : null,
    user_metadata:
      value.user_metadata && typeof value.user_metadata === "object"
        ? (value.user_metadata as Record<string, unknown>)
        : undefined,
  };
}

type ProfileMapRow = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  registration_id: string | null;
  session_preference: string | null;
  external_auth_id?: string | null;
};

async function mapExternalUserToProfile(
  external: ExternalAuthUser
): Promise<ExternalAuthUser | null> {
  const db = createAdminSupabase();
  if (!db) return null;

  const existingBySubject = await db
    .from("profiles")
    .select("id, first_name, last_name, email, phone, registration_id, session_preference")
    .eq("external_auth_id", external.id)
    .maybeSingle();

  let profile = (existingBySubject.data as ProfileMapRow | null) ?? null;

  // Email fallback is migration-only: bind only unbound profiles. Never steal an
  // account that already has a different external_auth_id.
  if (!profile) {
    const existingByEmail = await db
      .from("profiles")
      .select(
        "id, first_name, last_name, email, phone, registration_id, session_preference, external_auth_id"
      )
      .ilike("email", external.email)
      .maybeSingle();
    const byEmail = (existingByEmail.data as ProfileMapRow | null) ?? null;
    if (byEmail?.external_auth_id && byEmail.external_auth_id !== external.id) {
      console.warn(
        "[external-session] refused email rebind: profile already linked to another subject"
      );
      return null;
    }
    if (byEmail && !byEmail.external_auth_id) {
      profile = byEmail;
    }
  }

  const names = (external.name ?? "").trim().split(/\s+/).filter(Boolean);
  const firstName = names[0] || null;
  const lastName = names.slice(1).join(" ") || null;

  if (profile) {
    const { data, error } = await db
      .from("profiles")
      .update({
        external_auth_id: external.id,
        email: external.email,
        first_name: profile.first_name || firstName,
        last_name: profile.last_name || lastName,
        updated_at: new Date().toISOString(),
      })
      .eq("id", profile.id)
      .select("id, first_name, last_name, email, phone, registration_id, session_preference")
      .single();
    if (error || !data) return null;
    profile = data;

    if (!profile.registration_id?.trim()) {
      const registrationId = await ensureProfileRegistrationId(db, profile.id);
      if (registrationId) {
        profile = { ...profile, registration_id: registrationId };
      }
    }
  } else {
    let registrationId: string | null = null;
    const { data: generatedId } = await db.rpc("generate_registration_id");
    if (typeof generatedId === "string" && generatedId.trim()) {
      registrationId = generatedId.trim();
    }

    const { data, error } = await db
      .from("profiles")
      .insert({
        id: randomUUID(),
        external_auth_id: external.id,
        email: external.email,
        first_name: firstName,
        last_name: lastName,
        ...(registrationId ? { registration_id: registrationId } : {}),
      })
      .select("id, first_name, last_name, email, phone, registration_id, session_preference")
      .single();
    if (error || !data) return null;
    profile = data;

    if (!profile.registration_id?.trim()) {
      const backfilled = await ensureProfileRegistrationId(db, profile.id);
      if (backfilled) {
        profile = { ...profile, registration_id: backfilled };
      }
    }

    // Brand-new external-auth account — send welcome once (email required; SMS if phone).
    try {
      const { maybeSendCustomerWelcomeEmail } = await import(
        "@/lib/customer/welcome-email"
      );
      const welcome = await maybeSendCustomerWelcomeEmail({
        userId: profile.id,
        email: profile.email || external.email,
        name:
          [profile.first_name, profile.last_name].filter(Boolean).join(" ").trim() ||
          external.name,
        phone: profile.phone,
        registrationId: profile.registration_id,
        knownNewAccount: true,
      });
      if (!welcome.emailSent && welcome.reason === "send_failed") {
        console.warn("[external-session] welcome email failed to send");
      }
    } catch (welcomeError) {
      console.warn(
        "[external-session] welcome email skipped:",
        welcomeError instanceof Error ? welcomeError.message : welcomeError
      );
      const { logAppError } = await import("@/lib/errors/logger");
      logAppError({
        error: welcomeError,
        module: "customer.external-session.welcome",
        userMessage: "The welcome email could not be sent.",
        kind: "external_service",
        status: 502,
        actor: { id: profile.id, type: "customer" },
      });
    }
  }

  return {
    ...external,
    id: profile.id,
    email: profile.email || external.email,
    name:
      [profile.first_name, profile.last_name].filter(Boolean).join(" ").trim() ||
      external.name ||
      null,
    user_metadata: {
      ...(external.user_metadata ?? {}),
      external_auth_id: external.id,
      full_name:
        [profile.first_name, profile.last_name].filter(Boolean).join(" ").trim() ||
        external.name ||
        "",
      profile: {
        id: profile.id,
        first_name: profile.first_name,
        last_name: profile.last_name,
        phone: profile.phone,
        registration_id: profile.registration_id,
        session_preference: profile.session_preference,
      },
    },
  };
}

export async function resolveExternalAuthSession(
  requestHeaders: Headers
): Promise<ExternalAuthSession | null> {
  const cookieName = process.env.AUTH_SESSION_COOKIE_NAME?.trim();
  if (!cookieName) return null;
  const cookie = requestHeaders
    .get("cookie")
    ?.split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${cookieName}=`));
  if (!cookie) return null;

  const response = await fetch(
    new URL("/api/auth/session", getAuthServiceUrl()),
    {
      method: "GET",
      headers: {
        Cookie: cookie,
        Accept: "application/json",
      },
      cache: "no-store",
    }
  ).catch(() => null);

  if (!response?.ok) return null;
  const payload = (await response.json().catch(() => null)) as
    | { user?: unknown; expires?: unknown }
    | null;
  const external = normalizedUser(payload?.user);
  if (!external) return null;

  const user = await mapExternalUserToProfile(external);
  if (!user) return null;

  return {
    user,
    expires: typeof payload?.expires === "string" ? payload.expires : null,
  };
}
