import "server-only";
import { generateToken, hashToken } from "@/lib/platform/password";
import { createAdminSupabase } from "@/lib/supabase/admin";
import {
  isMissingRelationError,
  isSchemaMissing,
  markSchemaMissing,
  SCHEMA_CAPS,
} from "@/lib/observability/schema-capability";
import { reportSchemaIssue } from "@/lib/observability/schema-issue";
import {
  computePlatformPasswordResetExpiresAt,
  isPlatformPasswordResetExpired,
  PLATFORM_PASSWORD_RESET_EXPIRY_LABEL,
  PLATFORM_PASSWORD_RESET_TTL_MS,
  buildPlatformForgotPasswordUrl,
  buildPlatformPasswordResetUrl,
} from "@/lib/platform/password-reset-url";

export {
  computePlatformPasswordResetExpiresAt,
  isPlatformPasswordResetExpired,
  PLATFORM_PASSWORD_RESET_EXPIRY_LABEL,
  PLATFORM_PASSWORD_RESET_TTL_MS,
  buildPlatformForgotPasswordUrl,
  buildPlatformPasswordResetUrl,
};

const TABLE = "platform_password_reset_tokens";
const SCHEMA_KEY = SCHEMA_CAPS.platformPasswordResetTokens;

function reportMissingTable(message: string, source: string) {
  markSchemaMissing(SCHEMA_KEY);
  reportSchemaIssue({
    table: TABLE,
    migration: "094_platform_password_reset_tokens.sql",
    source,
    message,
  });
}

export type PlatformPasswordResetUser = {
  id: string;
  email: string;
  name: string | null;
  phone: string | null;
  role: string;
  status: string;
};

/**
 * Look up an active team account by email. Pending/disabled accounts cannot
 * self-reset (they use invite flow or owner intervention).
 */
export async function lookupActivePlatformUserByEmail(
  email: string
): Promise<PlatformPasswordResetUser | null> {
  const supabase = createAdminSupabase();
  if (!supabase) return null;

  const normalized = email.trim().toLowerCase();
  if (!normalized) return null;

  const { data, error } = await supabase
    .from("platform_users")
    .select("id, email, name, phone, role, status, password_hash, deleted_at")
    .eq("email", normalized)
    .maybeSingle();

  if (error) {
    if (isMissingColumnDeletedAt(error.message)) {
      const { data: fallback } = await supabase
        .from("platform_users")
        .select("id, email, name, phone, role, status, password_hash")
        .eq("email", normalized)
        .maybeSingle();
      if (!fallback?.password_hash || fallback.status !== "active") return null;
      return {
        id: fallback.id,
        email: fallback.email,
        name: fallback.name,
        phone: fallback.phone,
        role: fallback.role,
        status: fallback.status,
      };
    }
    return null;
  }

  if (!data?.password_hash || data.status !== "active") return null;
  if (data.deleted_at) return null;

  return {
    id: data.id,
    email: data.email,
    name: data.name,
    phone: data.phone,
    role: data.role,
    status: data.status,
  };
}

function isMissingColumnDeletedAt(message?: string): boolean {
  if (!message) return false;
  const lower = message.toLowerCase();
  return lower.includes("deleted_at") && (lower.includes("column") || lower.includes("schema cache"));
}

export type CreateResetTokenResult =
  | { ok: true; token: string; expiresAt: string }
  | { ok: false; reason: "schema_missing" | "db_error" | "not_configured" };

/** Invalidate prior unused tokens and create a fresh one-time reset token. */
export async function createPlatformPasswordResetToken(params: {
  userId: string;
  requestedIp?: string | null;
}): Promise<CreateResetTokenResult> {
  if (isSchemaMissing(SCHEMA_KEY)) {
    return { ok: false, reason: "schema_missing" };
  }

  const supabase = createAdminSupabase();
  if (!supabase) return { ok: false, reason: "not_configured" };

  const token = generateToken();
  const tokenHash = await hashToken(token);
  const expiresAt = computePlatformPasswordResetExpiresAt();
  const nowIso = new Date().toISOString();

  const { error: invalidateError } = await supabase
    .from(TABLE)
    .update({ used_at: nowIso })
    .eq("user_id", params.userId)
    .is("used_at", null);

  if (invalidateError) {
    if (isMissingRelationError(invalidateError.message, TABLE)) {
      reportMissingTable(invalidateError.message, "platform-password-reset.create");
      return { ok: false, reason: "schema_missing" };
    }
    return { ok: false, reason: "db_error" };
  }

  const { error: insertError } = await supabase.from(TABLE).insert({
    user_id: params.userId,
    token_hash: tokenHash,
    expires_at: expiresAt,
    requested_ip: params.requestedIp?.trim() || null,
  });

  if (insertError) {
    if (isMissingRelationError(insertError.message, TABLE)) {
      reportMissingTable(insertError.message, "platform-password-reset.create");
      return { ok: false, reason: "schema_missing" };
    }
    return { ok: false, reason: "db_error" };
  }

  return { ok: true, token, expiresAt };
}

export type ValidResetToken = {
  id: string;
  userId: string;
  email: string;
  name: string | null;
  phone: string | null;
  role: string;
};

export type ValidateResetTokenResult =
  | { ok: true; row: ValidResetToken }
  | {
      ok: false;
      reason: "invalid" | "used" | "expired" | "schema_missing" | "not_configured";
    };

export async function validatePlatformPasswordResetToken(
  rawToken: string
): Promise<ValidateResetTokenResult> {
  const token = rawToken.trim();
  if (!token || token.length < 32) return { ok: false, reason: "invalid" };
  if (isSchemaMissing(SCHEMA_KEY)) return { ok: false, reason: "schema_missing" };

  const supabase = createAdminSupabase();
  if (!supabase) return { ok: false, reason: "not_configured" };

  const tokenHash = await hashToken(token);
  const { data, error } = await supabase
    .from(TABLE)
    .select("id, user_id, expires_at, used_at")
    .eq("token_hash", tokenHash)
    .maybeSingle();

  if (error) {
    if (isMissingRelationError(error.message, TABLE)) {
      reportMissingTable(error.message, "platform-password-reset.validate");
      return { ok: false, reason: "schema_missing" };
    }
    return { ok: false, reason: "invalid" };
  }

  if (!data) return { ok: false, reason: "invalid" };
  if (data.used_at) return { ok: false, reason: "used" };
  if (isPlatformPasswordResetExpired(data.expires_at)) {
    return { ok: false, reason: "expired" };
  }

  const { data: user } = await supabase
    .from("platform_users")
    .select("id, email, name, phone, role, status")
    .eq("id", data.user_id)
    .maybeSingle();

  if (!user || user.status !== "active") return { ok: false, reason: "invalid" };

  return {
    ok: true,
    row: {
      id: data.id,
      userId: user.id,
      email: user.email,
      name: user.name,
      phone: user.phone,
      role: user.role,
    },
  };
}

export type ConsumeResetTokenResult =
  | { ok: true; user: ValidResetToken }
  | {
      ok: false;
      reason: "invalid" | "used" | "expired" | "schema_missing" | "not_configured" | "db_error";
    };

/** Mark token used (single-use) after successful password update prep. */
export async function consumePlatformPasswordResetToken(
  rawToken: string
): Promise<ConsumeResetTokenResult> {
  const validated = await validatePlatformPasswordResetToken(rawToken);
  if (!validated.ok) return validated;

  const supabase = createAdminSupabase();
  if (!supabase) return { ok: false, reason: "not_configured" };

  const nowIso = new Date().toISOString();
  const { data: updated, error } = await supabase
    .from(TABLE)
    .update({ used_at: nowIso })
    .eq("id", validated.row.id)
    .is("used_at", null)
    .select("id")
    .maybeSingle();

  if (error || !updated?.id) {
    return { ok: false, reason: error ? "db_error" : "used" };
  }

  return { ok: true, user: validated.row };
}
