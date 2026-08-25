import "server-only";

import { createAdminSupabase } from "@/lib/supabase/admin";
import { notifyCustomer } from "@/lib/notifications/customer-notify";
import type { CustomerNotifyTemplate } from "@/lib/notifications/templates";
import { parseUserAgent } from "@/lib/customer/auth-security";
import {
  isMissingRelationError,
  markSchemaMissing,
  SCHEMA_CAPS,
} from "@/lib/observability/schema-capability";

type SecurityTemplate =
  | "mfa_enabled"
  | "mfa_disabled"
  | "password_changed"
  | "login_new_device"
  | "login_alert"
  | "login_attempt_failed"
  | "account_lockout";

/** Backoff between retry attempts when a prior send failed / raced. */
export const NEW_DEVICE_ALERT_RETRY_MS = 15 * 60_000;
export const LOGIN_ALERT_THROTTLE_MS = 15 * 60_000;
export const FAILED_LOGIN_ALERT_THROTTLE_MS = 15 * 60_000;

function loginAlertThrottleBucket(now = Date.now()): number {
  return Math.floor(now / LOGIN_ALERT_THROTTLE_MS);
}

function failedLoginAlertIdempotencyKey(email: string, now = Date.now()): string {
  return `login_attempt_failed:${email.slice(0, 120)}:${Math.floor(now / FAILED_LOGIN_ALERT_THROTTLE_MS)}`;
}

function loginAlertIdempotencyKey(userId: string, now = Date.now()): string {
  return `login_alert:${userId.slice(0, 120)}:${loginAlertThrottleBucket(now)}`;
}

function formatWhen(): string {
  return new Date().toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function formatDevice(userAgent?: string | null): string {
  const ua = parseUserAgent(userAgent);
  return `${ua.browser} on ${ua.os} (${ua.device})`;
}

async function loadProfileContact(userId: string): Promise<{
  email: string | null;
  phone: string | null;
  name: string | null;
}> {
  const admin = createAdminSupabase();
  if (!admin) return { email: null, phone: null, name: null };

  const { data } = await admin
    .from("profiles")
    .select("email, phone, first_name, last_name")
    .eq("id", userId)
    .maybeSingle();

  if (!data) return { email: null, phone: null, name: null };
  const name =
    [data.first_name, data.last_name].filter(Boolean).join(" ").trim() || null;
  return {
    email: data.email?.trim().toLowerCase() || null,
    phone: data.phone?.trim() || null,
    name,
  };
}

/**
 * Security-event outbound via notifyCustomer (email + SMS/WhatsApp).
 * Never throws — failures are logged inside notifyCustomer.
 */
export async function notifyCustomerSecurityEvent(params: {
  userId?: string | null;
  email?: string | null;
  phone?: string | null;
  customerName?: string | null;
  template: SecurityTemplate;
  data?: Record<string, string | undefined>;
  sourceTable?: string;
  sourceId?: string;
}): Promise<void> {
  try {
    let email = params.email?.trim().toLowerCase() || "";
    let phone = params.phone?.trim() || null;
    let name = params.customerName?.trim() || undefined;

    if (params.userId && (!email || !phone || !name)) {
      const profile = await loadProfileContact(params.userId);
      email = email || profile.email || "";
      phone = phone || profile.phone;
      name = name || profile.name || undefined;
    }

    if (!email && !phone) return;

    await notifyCustomer({
      email: email || undefined,
      phone,
      customerName: name,
      template: params.template as CustomerNotifyTemplate,
      data: params.data,
      sourceTable: params.sourceTable ?? "profiles",
      sourceId: params.sourceId ?? params.userId ?? undefined,
      emailRequired: Boolean(email),
    });
  } catch (error) {
    console.warn(
      "[security-notify] non-blocking failure:",
      error instanceof Error ? error.message : error
    );
  }
}

export async function notifyPasswordChanged(params: {
  userId: string;
  email?: string | null;
}): Promise<void> {
  await notifyCustomerSecurityEvent({
    userId: params.userId,
    email: params.email,
    template: "password_changed",
    sourceId: `${params.userId}:password_changed:${new Date().toISOString().slice(0, 13)}`,
  });
}

export async function notifyMfaChanged(params: {
  userId: string;
  email?: string | null;
  enabled: boolean;
}): Promise<void> {
  await notifyCustomerSecurityEvent({
    userId: params.userId,
    email: params.email,
    template: params.enabled ? "mfa_enabled" : "mfa_disabled",
    sourceId: `${params.userId}:mfa:${params.enabled ? "on" : "off"}:${Date.now()}`,
  });
}

export async function notifyAccountLockout(params: {
  email: string;
}): Promise<void> {
  const email = params.email.trim().toLowerCase();
  if (!email) return;

  const admin = createAdminSupabase();
  let userId: string | undefined;
  let phone: string | null = null;
  let name: string | undefined;

  if (admin) {
    const { data } = await admin
      .from("profiles")
      .select("id, phone, first_name, last_name")
      .ilike("email", email)
      .maybeSingle();
    if (data) {
      userId = data.id;
      phone = data.phone?.trim() || null;
      name =
        [data.first_name, data.last_name].filter(Boolean).join(" ").trim() ||
        undefined;
    }
  }

  await notifyCustomerSecurityEvent({
    userId,
    email,
    phone,
    customerName: name,
    template: "account_lockout",
    sourceId: `${email}:lockout:${new Date().toISOString().slice(0, 13)}`,
  });
}

/**
 * Fire once per session fingerprint when the account already has history.
 * Skips the very first tracked session (normal first sign-in / welcome path).
 * Retries after NEW_DEVICE_ALERT_RETRY_MS if a prior attempt never reached "sent".
 */
export async function maybeNotifyNewDeviceLogin(params: {
  userId: string;
  email?: string | null;
  phone?: string | null;
  customerName?: string | null;
  fingerprint: string;
  /** @deprecated Callers may still pass this; decision no longer depends on it. */
  isNewSession?: boolean;
  userAgent?: string | null;
  ip?: string | null;
}): Promise<boolean> {
  if (!params.userId || !params.fingerprint) return false;

  const admin = createAdminSupabase();
  if (!admin) return false;

  try {
    const { count, error: countError } = await admin
      .from("customer_sessions")
      .select("id", { count: "exact", head: true })
      .eq("user_id", params.userId);

    if (countError) {
      if (isMissingRelationError(countError.message, "customer_sessions")) {
        markSchemaMissing(SCHEMA_CAPS.customerSessions);
      }
      return false;
    }

    // First tracked session is expected — do not treat as "new device".
    if ((count ?? 0) <= 1) return false;

    const sourceId = `${params.userId}:${params.fingerprint}`;
    const { data: priorRows } = await admin
      .from("notification_log")
      .select("id, status, created_at")
      .eq("template", "login_new_device")
      .eq("source_table", "customer_sessions")
      .eq("source_id", sourceId)
      .order("created_at", { ascending: false })
      .limit(5);

    const priors = priorRows ?? [];
    if (priors.some((row) => row.status === "sent")) return false;

    const recentCutoff = Date.now() - NEW_DEVICE_ALERT_RETRY_MS;
    const recentAttempt = priors.find((row) => {
      const created = row.created_at ? new Date(row.created_at).getTime() : 0;
      return created >= recentCutoff;
    });
    if (recentAttempt) return false;

    const ua = parseUserAgent(params.userAgent);
    const device = `${ua.browser} on ${ua.os} (${ua.device})`;
    const when = new Date().toLocaleString(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    });

    await notifyCustomerSecurityEvent({
      userId: params.userId,
      email: params.email,
      phone: params.phone,
      customerName: params.customerName,
      template: "login_new_device",
      data: {
        when,
        device,
        ip: params.ip ?? undefined,
      },
      sourceTable: "customer_sessions",
      sourceId,
    });
    return true;
  } catch (error) {
    console.warn(
      "[security-notify] new-device check failed:",
      error instanceof Error ? error.message : error
    );
    return false;
  }
}

/**
 * Throttled sign-in alert (parity with platform staff login alerts).
 * Skips when a new-device alert was already sent for this sign-in window.
 */
export async function maybeNotifyLoginAlert(params: {
  userId: string;
  email?: string | null;
  phone?: string | null;
  customerName?: string | null;
  userAgent?: string | null;
  ip?: string | null;
  /** When true, a new-device alert already went out for this sign-in. */
  skipIfNewDeviceSent?: boolean;
}): Promise<boolean> {
  if (!params.userId) return false;
  if (params.skipIfNewDeviceSent) return false;

  const admin = createAdminSupabase();
  if (!admin) return false;

  const sourceId = loginAlertIdempotencyKey(params.userId);
  try {
    const { data: prior } = await admin
      .from("notification_log")
      .select("id, status")
      .eq("template", "login_alert")
      .eq("source_table", "profiles")
      .eq("source_id", sourceId)
      .in("status", ["sent", "queued"])
      .limit(1)
      .maybeSingle();

    if (prior?.id) return false;

    const when = formatWhen();
    const device = formatDevice(params.userAgent);

    await notifyCustomerSecurityEvent({
      userId: params.userId,
      email: params.email,
      phone: params.phone,
      customerName: params.customerName,
      template: "login_alert",
      data: {
        when,
        device,
        ip: params.ip ?? undefined,
      },
      sourceTable: "profiles",
      sourceId,
    });
    return true;
  } catch (error) {
    console.warn(
      "[security-notify] login alert failed:",
      error instanceof Error ? error.message : error
    );
    return false;
  }
}

/**
 * Notify the account owner when someone fails to sign in with their email.
 * Always returns without leaking whether the account exists.
 */
export async function notifyFailedLoginAttempt(params: {
  email: string;
  ip?: string | null;
  userAgent?: string | null;
  method?: string;
}): Promise<boolean> {
  const email = params.email.trim().toLowerCase();
  if (!email) return false;

  const admin = createAdminSupabase();
  if (!admin) return false;

  try {
    const { data: profile } = await admin
      .from("profiles")
      .select("id, email, phone, first_name, last_name")
      .ilike("email", email)
      .maybeSingle();

    if (!profile?.id) return false;

    const sourceId = failedLoginAlertIdempotencyKey(email);
    const { data: prior } = await admin
      .from("notification_log")
      .select("id, status")
      .eq("template", "login_attempt_failed")
      .eq("source_table", "profiles")
      .eq("source_id", sourceId)
      .in("status", ["sent", "queued"])
      .limit(1)
      .maybeSingle();

    if (prior?.id) return false;

    const name =
      [profile.first_name, profile.last_name].filter(Boolean).join(" ").trim() ||
      undefined;
    const when = formatWhen();
    const device = formatDevice(params.userAgent);

    await notifyCustomerSecurityEvent({
      userId: profile.id,
      email: profile.email || email,
      phone: profile.phone,
      customerName: name,
      template: "login_attempt_failed",
      data: {
        when,
        device,
        ip: params.ip ?? undefined,
      },
      sourceTable: "profiles",
      sourceId,
    });
    return true;
  } catch (error) {
    console.warn(
      "[security-notify] failed-login notify error:",
      error instanceof Error ? error.message : error
    );
    return false;
  }
}
