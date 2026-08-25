import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin/auth";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { prepareSelfServicePasswordChange } from "@/lib/platform/password-change";
import { logPlatformActivity } from "@/lib/platform/activity";
import { enqueueAuditLog } from "@/lib/audit/write";
import { consumeRateLimitDurable, requestIp } from "@/lib/security/rate-limit";
import { getPublicSiteUrl } from "@/lib/site-url";
import { adminDashboardPath, PLATFORM_USER_COOKIE } from "@/lib/admin/config";
import { platformPath } from "@/lib/platform/paths";
import { sendPlatformPasswordChangedEmail } from "@/lib/email/platform-invite";
import { notifyTeamPasswordChanged } from "@/lib/notifications/platform-team-whatsapp";
import { assertSameOrigin, forbiddenOriginResponse } from "@/lib/security/csrf";
import {
  buildPlatformSessionCookieValue,
  PLATFORM_SESSION_TTL_SEC,
} from "@/lib/platform/session";
import {
  authSessionCookieOptions,
} from "@/lib/security/session-cookie-options";
import { isSchemaMissing, SCHEMA_CAPS } from "@/lib/observability/schema-capability";

export async function POST(req: NextRequest) {
  if (!assertSameOrigin(req)) {
    return forbiddenOriginResponse();
  }

  const auth = await requireAdmin({ allowPasswordChangePending: true });
  if (!auth.ok) {
    return NextResponse.json({ ok: false, message: auth.message }, { status: auth.status });
  }

  if (auth.auth.type !== "user" || !auth.auth.userId) {
    return NextResponse.json(
      { ok: false, message: "Password change is only available for team accounts." },
      { status: 403 }
    );
  }

  const rateLimit = await consumeRateLimitDurable(
    "admin-change-password",
    `${requestIp(req.headers)}:${auth.auth.userId}`,
    { limit: 5, windowMs: 15 * 60_000 }
  );
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { ok: false, message: "Too many password change attempts. Try again later." },
      {
        status: 429,
        headers: { "Retry-After": String(rateLimit.retryAfterSeconds) },
      }
    );
  }

  const body = await req.json().catch(() => ({}));
  const currentPassword = typeof body.currentPassword === "string" ? body.currentPassword : "";
  const newPassword = typeof body.newPassword === "string" ? body.newPassword : "";

  const supabase = createAdminSupabase();
  if (!supabase) {
    return NextResponse.json({ ok: false, message: "Database not configured." }, { status: 503 });
  }

  const userId = auth.auth.userId;
  const { data: user, error } = await supabase
    .from("platform_users")
    .select("id, email, name, phone, password_hash")
    .eq("id", userId)
    .maybeSingle();

  if (error || !user) {
    return NextResponse.json({ ok: false, message: "Account not found." }, { status: 404 });
  }

  const prepared = await prepareSelfServicePasswordChange({
    currentPassword,
    newPassword,
    storedHash: user.password_hash,
  });

  if (!prepared.ok) {
    enqueueAuditLog({
      action: "password_changed",
      success: false,
      actor: auth.auth,
      targetType: "platform_user",
      targetId: userId,
      targetName: user.email,
      errorMessage: prepared.message,
      request: req,
    });
    return NextResponse.json(
      { ok: false, message: prepared.message },
      { status: prepared.status }
    );
  }

  const updatePayload: Record<string, unknown> = {
    password_hash: prepared.passwordHash,
  };
  if (!isSchemaMissing(SCHEMA_CAPS.platformUsersMustChangePassword)) {
    updatePayload.must_change_password = false;
  }

  const { data: updated, error: updateError } = await supabase
    .from("platform_users")
    .update(updatePayload)
    .eq("id", userId)
    .select("id")
    .maybeSingle();

  if (updateError || !updated?.id) {
    enqueueAuditLog({
      action: "password_changed",
      success: false,
      actor: auth.auth,
      targetType: "platform_user",
      targetId: userId,
      targetName: user.email,
      errorMessage: updateError?.message ?? "update_failed",
      request: req,
    });
    return NextResponse.json(
      {
        ok: false,
        message: updateError?.message ?? "Could not save the new password. Try again.",
      },
      { status: 500 }
    );
  }

  await logPlatformActivity(auth.auth, "user_updated", userId, {
    password_changed: true,
  });
  enqueueAuditLog({
    action: "password_changed",
    success: true,
    actor: auth.auth,
    targetType: "platform_user",
    targetId: userId,
    targetName: user.email,
    request: req,
  });

  const when = new Date().toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
  const ip = requestIp(req.headers);
  const securityUrl = `${getPublicSiteUrl()}${platformPath("account/security")}`;

  // Notify only after the hash is confirmed saved — never on validation failure.
  if (user.email?.trim()) {
    void sendPlatformPasswordChangedEmail({
      to: user.email.trim(),
      name: user.name || "there",
      when,
      ip,
      securityUrl,
    }).catch((err) => {
      console.warn(
        "[change-password] notify email failed (non-blocking):",
        err instanceof Error ? err.message : err
      );
    });
  }
  void notifyTeamPasswordChanged({
    phone: user.phone,
    name: user.name || "there",
    when,
    ip,
    securityUrl,
    userId,
  }).catch(() => {});

  const wasForcedChange = Boolean(auth.auth.mustChangePassword);
  const res = NextResponse.json({
    ok: true,
    message: wasForcedChange
      ? "Password updated. Redirecting to your dashboard…"
      : "Password updated. You will need to sign in again on other devices.",
    redirect: wasForcedChange ? adminDashboardPath() : undefined,
  });

  const sessionValue = await buildPlatformSessionCookieValue(
    userId,
    auth.auth.role,
    prepared.passwordHash,
    { mustChangePassword: false }
  );
  res.cookies.set(
    PLATFORM_USER_COOKIE,
    sessionValue,
    authSessionCookieOptions(PLATFORM_SESSION_TTL_SEC)
  );

  return res;
}
