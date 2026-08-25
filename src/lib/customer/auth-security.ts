import "server-only";

import { createAdminSupabase } from "@/lib/supabase/admin";
import { consumeRateLimit, requestIp } from "@/lib/security/rate-limit";
import { logAppError } from "@/lib/errors/logger";

const LOCKOUT_THRESHOLD = 5;
const LOCKOUT_WINDOW_MS = 15 * 60_000;
const LOCKOUT_DURATION_MS = 30 * 60_000;
const IP_LIMIT = 20;
const IP_WINDOW_MS = 15 * 60_000;

export type AuthAttemptContext = {
  email: string;
  ip?: string | null;
  userAgent?: string | null;
  userId?: string | null;
  method?: string;
};

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function parseUserAgent(ua: string | null | undefined): {
  browser: string;
  device: string;
  os: string;
} {
  const raw = ua?.trim() || "";
  if (!raw) {
    return { browser: "Unknown", device: "Unknown", os: "Unknown" };
  }

  let os = "Unknown";
  if (/Windows/i.test(raw)) os = "Windows";
  else if (/Android/i.test(raw)) os = "Android";
  else if (/iPhone|iPad|iOS/i.test(raw)) os = "iOS";
  else if (/Mac OS X|Macintosh/i.test(raw)) os = "macOS";
  else if (/Linux/i.test(raw)) os = "Linux";

  let browser = "Unknown";
  if (/Edg\//i.test(raw)) browser = "Edge";
  else if (/Chrome\//i.test(raw) && !/Edg\//i.test(raw)) browser = "Chrome";
  else if (/Safari\//i.test(raw) && !/Chrome\//i.test(raw)) browser = "Safari";
  else if (/Firefox\//i.test(raw)) browser = "Firefox";

  let device = "Desktop";
  if (/Mobile|Android|iPhone|iPod/i.test(raw)) device = "Mobile";
  else if (/iPad|Tablet/i.test(raw)) device = "Tablet";

  return { browser, device, os };
}

export async function checkCustomerLoginAllowed(
  email: string,
  headers: Headers
): Promise<{ allowed: true } | { allowed: false; message: string; status: number }> {
  const normalized = normalizeEmail(email);
  const ip = requestIp(headers);

  const ipLimit = consumeRateLimit("customer-login-ip", ip, {
    limit: IP_LIMIT,
    windowMs: IP_WINDOW_MS,
  });
  if (!ipLimit.allowed) {
    return {
      allowed: false,
      message: "Too many sign-in attempts from this network. Please wait and try again.",
      status: 429,
    };
  }

  const emailLimit = consumeRateLimit("customer-login-email", `${ip}:${normalized}`, {
    limit: LOCKOUT_THRESHOLD,
    windowMs: LOCKOUT_WINDOW_MS,
  });
  if (!emailLimit.allowed) {
    return {
      allowed: false,
      message: "Too many sign-in attempts. Please wait a few minutes and try again.",
      status: 429,
    };
  }

  const admin = createAdminSupabase();
  if (!admin) return { allowed: true };

  try {
    const { data } = await admin
      .from("customer_auth_lockouts")
      .select("locked_until, failed_count")
      .eq("email", normalized)
      .maybeSingle();

    if (data?.locked_until) {
      const until = new Date(data.locked_until).getTime();
      if (until > Date.now()) {
        const mins = Math.max(1, Math.ceil((until - Date.now()) / 60_000));
        return {
          allowed: false,
          message: `This account is temporarily locked after too many failed attempts. Try again in about ${mins} minute${mins === 1 ? "" : "s"}.`,
          status: 423,
        };
      }
    }
  } catch (error) {
    await logAppError({
      error,
      module: "customer.auth.lockout.check",
      userMessage: "Sign-in is temporarily unavailable.",
      kind: "database",
      status: 500,
      context: { email: normalized },
    });
  }

  return { allowed: true };
}

async function bumpLockout(email: string, success: boolean) {
  const admin = createAdminSupabase();
  if (!admin) return;
  const normalized = normalizeEmail(email);

  try {
    if (success) {
      await admin.from("customer_auth_lockouts").delete().eq("email", normalized);
      return;
    }

    const { data: existing } = await admin
      .from("customer_auth_lockouts")
      .select("failed_count, locked_until")
      .eq("email", normalized)
      .maybeSingle();

    const prev =
      existing?.locked_until && new Date(existing.locked_until).getTime() > Date.now()
        ? existing.failed_count
        : existing?.failed_count &&
            existing.locked_until &&
            new Date(existing.locked_until).getTime() <= Date.now()
          ? 0
          : (existing?.failed_count ?? 0);

    const failedCount = prev + 1;
    const wasLocked =
      Boolean(existing?.locked_until) &&
      new Date(existing!.locked_until!).getTime() > Date.now();
    const lockedUntil =
      failedCount >= LOCKOUT_THRESHOLD
        ? new Date(Date.now() + LOCKOUT_DURATION_MS).toISOString()
        : null;

    await admin.from("customer_auth_lockouts").upsert({
      email: normalized,
      failed_count: failedCount,
      locked_until: lockedUntil,
      updated_at: new Date().toISOString(),
    });

    // Notify once when a lockout is newly applied (not on every failed attempt).
    if (lockedUntil && !wasLocked) {
      try {
        const { notifyAccountLockout } = await import(
          "@/lib/customer/security-notify"
        );
        await notifyAccountLockout({ email: normalized });
      } catch {
        // non-blocking
      }
    }
  } catch {
    // Non-blocking — in-memory rate limit still applies
  }
}

export async function recordCustomerAuthAttempt(
  ctx: AuthAttemptContext & {
    success: boolean;
    reason?: string;
    suspicious?: boolean;
    country?: string | null;
    city?: string | null;
  }
): Promise<void> {
  const admin = createAdminSupabase();
  if (!admin) return;

  const email = normalizeEmail(ctx.email);
  const ua = parseUserAgent(ctx.userAgent);

  try {
    await admin.from("customer_auth_attempts").insert({
      email,
      user_id: ctx.userId ?? null,
      ip: ctx.ip ?? null,
      user_agent: ctx.userAgent ?? null,
      success: ctx.success,
      reason: ctx.reason ?? null,
    });
  } catch {
    // ignore
  }

  await bumpLockout(email, ctx.success);

  if (ctx.userId && ctx.success) {
    try {
      await admin.from("customer_login_history").insert({
        user_id: ctx.userId,
        email,
        ip: ctx.ip ?? null,
        user_agent: ctx.userAgent ?? null,
        browser: ua.browser,
        device: ua.device,
        os: ua.os,
        country: ctx.country ?? null,
        city: ctx.city ?? null,
        success: true,
        method: ctx.method ?? "password",
        suspicious: Boolean(ctx.suspicious),
      });
    } catch {
      // ignore until migration applied
    }
  }

  if (ctx.suspicious || (!ctx.success && ctx.reason === "invalid_credentials_burst")) {
    logAppError({
      error: new Error(ctx.reason ?? "suspicious_login"),
      module: "customer.auth.suspicious",
      userMessage: "Sign-in could not be completed.",
      kind: "unauthorized",
      status: 401,
      context: {
        email,
        ip: ctx.ip,
        suspicious: ctx.suspicious,
        success: ctx.success,
      },
    });
  }
}

export async function detectSuspiciousLogin(params: {
  userId: string;
  ip: string | null;
  country?: string | null;
}): Promise<boolean> {
  const admin = createAdminSupabase();
  if (!admin || !params.userId) return false;

  try {
    const { data } = await admin
      .from("customer_login_history")
      .select("ip, country")
      .eq("user_id", params.userId)
      .eq("success", true)
      .order("created_at", { ascending: false })
      .limit(10);

    const rows = data ?? [];
    if (rows.length === 0) return false;

    const knownIps = new Set(rows.map((r) => r.ip).filter(Boolean));
    const knownCountries = new Set(rows.map((r) => r.country).filter(Boolean));

    if (params.ip && knownIps.size > 0 && !knownIps.has(params.ip)) {
      if (params.country && knownCountries.size > 0 && !knownCountries.has(params.country)) {
        return true;
      }
      // New IP alone is soft-suspicious when history exists
      return knownIps.size >= 2;
    }
  } catch {
    return false;
  }

  return false;
}
