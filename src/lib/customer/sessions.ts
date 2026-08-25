import "server-only";

import { createHash, randomBytes } from "crypto";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { parseUserAgent } from "@/lib/customer/auth-security";
import {
  isMissingRelationError,
  isSchemaMissing,
  markSchemaMissing,
  SCHEMA_CAPS,
} from "@/lib/observability/schema-capability";

export function sessionFingerprint(parts: {
  userAgent?: string | null;
  ip?: string | null;
}): string {
  const raw = `${parts.userAgent ?? ""}|${parts.ip ?? ""}`;
  return createHash("sha256").update(raw).digest("hex").slice(0, 32);
}

export function hashRefreshToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export type UpsertCustomerSessionResult = {
  id: string | null;
  fingerprint: string;
  isNew: boolean;
};

export async function upsertCustomerSession(params: {
  userId: string;
  refreshToken?: string | null;
  ip?: string | null;
  userAgent?: string | null;
  country?: string | null;
  city?: string | null;
}): Promise<UpsertCustomerSessionResult> {
  const fingerprint = sessionFingerprint({
    userAgent: params.userAgent,
    ip: params.ip,
  });
  const empty: UpsertCustomerSessionResult = {
    id: null,
    fingerprint,
    isNew: false,
  };

  if (isSchemaMissing(SCHEMA_CAPS.customerSessions)) return empty;

  const admin = createAdminSupabase();
  if (!admin) return empty;

  const ua = parseUserAgent(params.userAgent);

  try {
    const { data: existing, error: existingError } = await admin
      .from("customer_sessions")
      .select("id")
      .eq("user_id", params.userId)
      .eq("session_fingerprint", fingerprint)
      .maybeSingle();

    if (existingError) {
      if (isMissingRelationError(existingError.message, "customer_sessions")) {
        markSchemaMissing(SCHEMA_CAPS.customerSessions);
      }
      return empty;
    }

    const { data, error } = await admin
      .from("customer_sessions")
      .upsert(
        {
          user_id: params.userId,
          session_fingerprint: fingerprint,
          refresh_token_hash: params.refreshToken
            ? hashRefreshToken(params.refreshToken)
            : null,
          ip: params.ip ?? null,
          user_agent: params.userAgent ?? null,
          browser: ua.browser,
          device: ua.device,
          os: ua.os,
          country: params.country ?? null,
          city: params.city ?? null,
          last_active_at: new Date().toISOString(),
          revoked_at: null,
        },
        { onConflict: "user_id,session_fingerprint" }
      )
      .select("id")
      .maybeSingle();

    if (error) {
      if (isMissingRelationError(error.message, "customer_sessions")) {
        markSchemaMissing(SCHEMA_CAPS.customerSessions);
      }
      return empty;
    }
    return {
      id: data?.id ?? null,
      fingerprint,
      isNew: !existing?.id,
    };
  } catch {
    return empty;
  }
}

export async function listCustomerSessions(userId: string) {
  const admin = createAdminSupabase();
  if (!admin) return [];
  const { data } = await admin
    .from("customer_sessions")
    .select(
      "id, browser, device, os, ip, country, city, last_active_at, created_at, revoked_at, session_fingerprint"
    )
    .eq("user_id", userId)
    .is("revoked_at", null)
    .order("last_active_at", { ascending: false })
    .limit(50);
  return data ?? [];
}

async function markCredentialsRevoked(userId: string): Promise<void> {
  const admin = createAdminSupabase();
  if (!admin) return;
  const now = new Date().toISOString();
  await admin
    .from("profiles")
    .update({ credentials_revoked_at: now, updated_at: now })
    .eq("id", userId);
}

async function signOutProviderSessions(
  userId: string,
  scope: "global" | "others"
): Promise<void> {
  const admin = createAdminSupabase();
  if (!admin) return;
  try {
    await admin.auth.admin.signOut(userId, scope);
  } catch (err) {
    console.warn(
      "[customer-sessions] provider signOut failed:",
      err instanceof Error ? err.message : err
    );
  }
}

export async function revokeCustomerSession(
  userId: string,
  sessionId: string
): Promise<boolean> {
  const admin = createAdminSupabase();
  if (!admin) return false;
  const { error } = await admin
    .from("customer_sessions")
    .update({ revoked_at: new Date().toISOString() })
    .eq("user_id", userId)
    .eq("id", sessionId);
  if (error) return false;

  // Drop other provider refresh sessions. Already-issued access JWTs may remain
  // valid until TTL; full kill-switch is revoke-all (credentials_revoked_at).
  await signOutProviderSessions(userId, "others");
  return true;
}

export async function revokeAllCustomerSessions(
  userId: string,
  exceptFingerprint?: string | null
): Promise<number> {
  const admin = createAdminSupabase();
  if (!admin) return 0;
  let query = admin
    .from("customer_sessions")
    .update({ revoked_at: new Date().toISOString() })
    .eq("user_id", userId)
    .is("revoked_at", null);
  if (exceptFingerprint) {
    query = query.neq("session_fingerprint", exceptFingerprint);
  }
  const { data, error } = await query.select("id");
  if (error) return 0;

  if (exceptFingerprint) {
    // Keep the caller's session; invalidate other refresh tokens at the provider.
    await signOutProviderSessions(userId, "others");
  } else {
    // Invalidate every credential, including in-flight access tokens via iat check.
    await markCredentialsRevoked(userId);
    await signOutProviderSessions(userId, "global");
  }
  return data?.length ?? 0;
}

export function newDeviceId(): string {
  return randomBytes(12).toString("hex");
}
