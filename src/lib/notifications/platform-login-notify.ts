import "server-only";

import { headers } from "next/headers";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { parseUserAgent } from "@/lib/customer/auth-security";
import { requestIp } from "@/lib/security/rate-limit";
import { platformPath } from "@/lib/platform/paths";
import { getPublicSiteUrl } from "@/lib/site-url";
import { sendPlatformLoginAlertEmail, sendPlatformFailedLoginAlertEmail } from "@/lib/email/platform-invite";
import { notifyTeamLoginAlert, notifyTeamFailedLoginAlert } from "@/lib/notifications/platform-team-whatsapp";
import { insertWhatsAppNotificationLog } from "@/lib/notifications/whatsapp-log";
import type { PlatformRole } from "@/lib/platform/permissions";

/** Suppress identical login alerts within this window (refresh / double-submit spam). */
export const PLATFORM_LOGIN_ALERT_THROTTLE_MS = 15 * 60_000;

const TEMPLATE = "platform_login";
const FAILED_TEMPLATE = "platform_login_failed";

function securitySettingsUrl(siteUrl = getPublicSiteUrl()): string {
  return new URL(
    platformPath("account/security").replace(/^\//, ""),
    `${siteUrl}/`
  ).toString();
}

function throttleBucket(now = Date.now()): number {
  return Math.floor(now / PLATFORM_LOGIN_ALERT_THROTTLE_MS);
}

/** Unique per user + 15-minute window — first claim wins; never blocks forever. */
export function platformLoginAlertIdempotencyKey(
  userKey: string,
  now = Date.now()
): string {
  return `${TEMPLATE}:${userKey.slice(0, 120)}:${throttleBucket(now)}`;
}

async function recentlyNotified(userKey: string): Promise<boolean> {
  const supabase = createAdminSupabase();
  if (!supabase) return false;

  const since = new Date(Date.now() - PLATFORM_LOGIN_ALERT_THROTTLE_MS).toISOString();
  try {
    const { data } = await supabase
      .from("notification_log")
      .select("id")
      .eq("template", TEMPLATE)
      .eq("source_table", "platform_users")
      .eq("source_id", userKey)
      .in("status", ["sent", "queued"])
      .gte("created_at", since)
      .limit(1)
      .maybeSingle();
    return Boolean(data?.id);
  } catch {
    // Fail open — a missing table must not suppress the first login alert forever.
    return false;
  }
}

/**
 * Claim this throttle window via unique idempotency_key.
 * Returns false when another sender already claimed the window.
 */
async function claimThrottleWindow(userKey: string): Promise<boolean> {
  const key = platformLoginAlertIdempotencyKey(userKey);
  const id = await insertWhatsAppNotificationLog({
    sourceTable: "platform_users",
    sourceId: userKey,
    template: TEMPLATE,
    channel: "system",
    status: "queued",
    recipient: userKey,
    provider: "throttle",
    idempotencyKey: key,
    detail: { reason: "platform_login_throttle_claim" },
  });
  // insert returns null on unique conflict or DB error — treat conflict as claimed.
  if (id) return true;

  // Distinguish unique race (already claimed) from soft DB failure: re-check recent.
  return !(await recentlyNotified(userKey));
}

/**
 * Email (+ SMS when phone is on platform_users) after a successful platform sign-in.
 * Fire-and-forget; never blocks login. Throttled to one alert per user per 15 minutes.
 * Invite-accept already sends welcome — do not call this from that route.
 */
export function schedulePlatformLoginAlert(params: {
  userId?: string | null;
  name: string;
  email: string;
  role: PlatformRole | string;
  phone?: string | null;
  /** When omitted, read from the current request headers. */
  ip?: string | null;
  userAgent?: string | null;
}): void {
  void notifyPlatformLoginAlert(params).catch((error) => {
    console.warn(
      "[platform-login-notify] non-blocking failure:",
      error instanceof Error ? error.message : error
    );
  });
}

export async function notifyPlatformLoginAlert(params: {
  userId?: string | null;
  name: string;
  email: string;
  role: PlatformRole | string;
  phone?: string | null;
  ip?: string | null;
  userAgent?: string | null;
}): Promise<void> {
  const email = params.email?.trim().toLowerCase() || "";
  const userKey = (params.userId?.trim() || email || "").slice(0, 120);
  if (!userKey && !email) return;

  if (userKey && (await recentlyNotified(userKey))) return;
  if (userKey && !(await claimThrottleWindow(userKey))) return;

  let phone = params.phone?.trim() || null;
  if (params.userId && !phone) {
    const supabase = createAdminSupabase();
    if (supabase) {
      const { data } = await supabase
        .from("platform_users")
        .select("phone")
        .eq("id", params.userId)
        .maybeSingle();
      phone = data?.phone?.trim() || null;
    }
  }

  let ip = params.ip?.trim() || null;
  let userAgent = params.userAgent?.trim() || null;
  if (!ip || !userAgent) {
    try {
      const h = await headers();
      ip = ip || requestIp(h);
      userAgent = userAgent || h.get("user-agent");
    } catch {
      // Outside a request context — still send without IP/UA.
    }
  }
  if (ip === "unknown") ip = null;

  const when = new Date().toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
  const ua = parseUserAgent(userAgent);
  const device = `${ua.browser} on ${ua.os} (${ua.device})`;
  const securityUrl = securitySettingsUrl();

  if (email) {
    const result = await sendPlatformLoginAlertEmail({
      to: email,
      name: params.name,
      role: params.role,
      when,
      ip,
      device,
      securityUrl,
    });
    await insertWhatsAppNotificationLog({
      sourceTable: "platform_users",
      sourceId: userKey || email,
      template: TEMPLATE,
      channel: "email",
      status: result.emailSent ? "sent" : "failed",
      recipient: email,
      provider: "resend",
      providerMessageId: result.emailSent ? result.messageId : undefined,
      detail: result.emailSent
        ? { provider: "resend" }
        : {
            reason: "emailError" in result ? result.emailError : "Email send failed",
            provider: "resend",
          },
    });
  }

  if (phone) {
    await notifyTeamLoginAlert({
      phone,
      name: params.name,
      role: params.role,
      when,
      ip,
      securityUrl,
      userId: userKey || params.userId || undefined,
    });
  }
}

function failedLoginAlertIdempotencyKey(userKey: string, now = Date.now()): string {
  return `${FAILED_TEMPLATE}:${userKey.slice(0, 120)}:${throttleBucket(now)}`;
}

async function recentlyNotifiedFailed(userKey: string): Promise<boolean> {
  const supabase = createAdminSupabase();
  if (!supabase) return false;

  const since = new Date(Date.now() - PLATFORM_LOGIN_ALERT_THROTTLE_MS).toISOString();
  try {
    const { data } = await supabase
      .from("notification_log")
      .select("id")
      .eq("template", FAILED_TEMPLATE)
      .eq("source_table", "platform_users")
      .eq("source_id", userKey)
      .in("status", ["sent", "queued"])
      .gte("created_at", since)
      .limit(1)
      .maybeSingle();
    return Boolean(data?.id);
  } catch {
    return false;
  }
}

async function claimFailedThrottleWindow(userKey: string): Promise<boolean> {
  const key = failedLoginAlertIdempotencyKey(userKey);
  const id = await insertWhatsAppNotificationLog({
    sourceTable: "platform_users",
    sourceId: userKey,
    template: FAILED_TEMPLATE,
    channel: "system",
    status: "queued",
    recipient: userKey,
    provider: "throttle",
    idempotencyKey: key,
    detail: { reason: "platform_failed_login_throttle_claim" },
  });
  if (id) return true;
  return !(await recentlyNotifiedFailed(userKey));
}

/**
 * Email (+ SMS when phone on file) after a failed platform sign-in attempt.
 * Fire-and-forget; throttled to one alert per account per 15 minutes.
 */
export function schedulePlatformFailedLoginAlert(params: {
  email: string;
  ip?: string | null;
  userAgent?: string | null;
}): void {
  void notifyPlatformFailedLoginAlert(params).catch((error) => {
    console.warn(
      "[platform-login-notify] failed-login non-blocking failure:",
      error instanceof Error ? error.message : error
    );
  });
}

export async function notifyPlatformFailedLoginAlert(params: {
  email: string;
  ip?: string | null;
  userAgent?: string | null;
}): Promise<void> {
  const email = params.email.trim().toLowerCase();
  if (!email) return;

  const supabase = createAdminSupabase();
  if (!supabase) return;

  const { data: user } = await supabase
    .from("platform_users")
    .select("id, name, email, role, phone, status")
    .eq("email", email)
    .maybeSingle();

  const ownerEmail = (process.env.OWNER_EMAIL ?? "owner@nabusmotors.com")
    .trim()
    .toLowerCase();
  const isOwnerAttempt = email === ownerEmail;

  if ((!user || user.status === "disabled") && !isOwnerAttempt) return;

  const userKey = (user?.id || email).slice(0, 120);
  if (await recentlyNotifiedFailed(userKey)) return;
  if (!(await claimFailedThrottleWindow(userKey))) return;

  let ip = params.ip?.trim() || null;
  let userAgent = params.userAgent?.trim() || null;
  if (!ip || !userAgent) {
    try {
      const h = await headers();
      ip = ip || requestIp(h);
      userAgent = userAgent || h.get("user-agent");
    } catch {
      // Outside request context.
    }
  }
  if (ip === "unknown") ip = null;

  const when = new Date().toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
  const ua = parseUserAgent(userAgent);
  const device = `${ua.browser} on ${ua.os} (${ua.device})`;
  const securityUrl = securitySettingsUrl();

  const alertName = user?.name || "Owner";
  const alertRole = user?.role || "owner";
  const alertEmail = user?.email || email;

  const result = await sendPlatformFailedLoginAlertEmail({
    to: alertEmail,
    name: alertName,
    role: alertRole,
    when,
    ip,
    device,
    securityUrl,
  });
  await insertWhatsAppNotificationLog({
    sourceTable: "platform_users",
    sourceId: userKey,
    template: FAILED_TEMPLATE,
    channel: "email",
    status: result.emailSent ? "sent" : "failed",
    recipient: alertEmail,
    provider: "resend",
    providerMessageId: result.emailSent ? result.messageId : undefined,
    detail: result.emailSent
      ? { provider: "resend" }
      : {
          reason: "emailError" in result ? result.emailError : "Email send failed",
          provider: "resend",
        },
  });

  const phone = user?.phone?.trim() || null;
  if (phone) {
    await notifyTeamFailedLoginAlert({
      phone,
      name: alertName,
      role: alertRole,
      when,
      ip,
      device,
      securityUrl,
      userId: userKey,
    });
  }
}
