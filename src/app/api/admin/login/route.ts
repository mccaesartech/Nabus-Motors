import { NextRequest, NextResponse } from "next/server";
import {
  ADMIN_COOKIE,
  PLATFORM_USER_COOKIE,
  adminDashboardPath,
  adminTokenForPassword,
  expectedAdminToken,
  isAdminSessionSecretConfigured,
} from "@/lib/admin/config";
import { authenticatePlatformUser } from "@/lib/admin/auth";
import {
  buildPlatformSessionCookieValue,
  PLATFORM_SESSION_TTL_SEC,
} from "@/lib/platform/session";
import { platformForcedPasswordChangeRedirectUrl } from "@/lib/platform/paths";
import { logPlatformActivity } from "@/lib/platform/activity";
import { enqueueAuditLog } from "@/lib/audit/write";
import { consumeRateLimitDurable, requestIp } from "@/lib/security/rate-limit";
import { assertSameOrigin, forbiddenOriginResponse } from "@/lib/security/csrf";
import {
  authSessionCookieOptions,
  clearAuthSessionCookieOptions,
} from "@/lib/security/session-cookie-options";
import { schedulePlatformLoginAlert, schedulePlatformFailedLoginAlert } from "@/lib/notifications/platform-login-notify";

export async function POST(req: NextRequest) {
  if (!assertSameOrigin(req)) {
    return forbiddenOriginResponse();
  }

  const body = await req.json().catch(() => ({}));
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const password = typeof body.password === "string" ? body.password : "";

  if (!password) {
    return NextResponse.json({ ok: false, message: "Password is required." }, { status: 400 });
  }
  if (!isAdminSessionSecretConfigured()) {
    return NextResponse.json(
      { ok: false, message: "Login is not configured on the server." },
      { status: 503 }
    );
  }

  const rateLimit = await consumeRateLimitDurable(
    "admin-password-login",
    `${requestIp(req.headers)}:${email || "owner"}`,
    { limit: 5, windowMs: 15 * 60_000 }
  );
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { ok: false, message: "Too many sign-in attempts. Try again later." },
      {
        status: 429,
        headers: { "Retry-After": String(rateLimit.retryAfterSeconds) },
      }
    );
  }

  if (email) {
    const result = await authenticatePlatformUser(email, password);
    if (result.status === "invite_required") {
      enqueueAuditLog({
        action: "login_failed",
        success: false,
        actorName: email,
        actorRole: "pending_invite",
        targetType: "platform_user",
        errorMessage: "invite_required",
        request: req,
      });
      return NextResponse.json(
        {
          ok: false,
          message:
            "This account is not activated yet. Open the invitation link from your email or WhatsApp to set your password.",
        },
        { status: 403 }
      );
    }
    if (result.status !== "success") {
      enqueueAuditLog({
        action: "login_failed",
        success: false,
        actorName: email,
        targetType: "platform_user",
        errorMessage: "invalid_credentials",
        request: req,
      });
      schedulePlatformFailedLoginAlert({
        email,
        ip: requestIp(req.headers),
        userAgent: req.headers.get("user-agent"),
      });
      return NextResponse.json({ ok: false, message: "Invalid email or password." }, { status: 401 });
    }

    const auth = result.auth;
    if (!auth.userId || !auth.passwordHash) {
      return NextResponse.json(
        { ok: false, message: "Account is not fully activated. Contact your administrator." },
        { status: 403 }
      );
    }

    const mustChangePassword = Boolean(auth.mustChangePassword);
    const sessionValue = await buildPlatformSessionCookieValue(
      auth.userId,
      auth.role,
      auth.passwordHash,
      { mustChangePassword }
    );
    const res = NextResponse.json({
      ok: true,
      redirect: mustChangePassword
        ? platformForcedPasswordChangeRedirectUrl()
        : adminDashboardPath(),
      mustChangePassword,
    });
    res.cookies.set(
      PLATFORM_USER_COOKIE,
      sessionValue,
      authSessionCookieOptions(PLATFORM_SESSION_TTL_SEC)
    );
    res.cookies.set(ADMIN_COOKIE, "", clearAuthSessionCookieOptions());

    await logPlatformActivity(auth, "login");
    enqueueAuditLog({
      action: "login",
      success: true,
      actor: auth,
      targetType: "platform_session",
      request: req,
    });
    schedulePlatformLoginAlert({
      userId: auth.userId,
      name: auth.name,
      email: auth.email,
      role: auth.role,
      ip: requestIp(req.headers),
      userAgent: req.headers.get("user-agent"),
    });
    return res;
  }

  const expected = await expectedAdminToken();
  if (!expected || !process.env.ADMIN_PASSWORD) {
    return NextResponse.json(
      { ok: false, message: "Login is not configured on the server." },
      { status: 503 }
    );
  }

  const submitted = await adminTokenForPassword(password);
  if (!submitted || submitted !== expected) {
    enqueueAuditLog({
      action: "login_failed",
      success: false,
      actorName: "Owner",
      actorRole: "owner",
      targetType: "platform_session",
      errorMessage: "invalid_credentials",
      request: req,
    });
    schedulePlatformFailedLoginAlert({
      email: process.env.OWNER_EMAIL ?? "owner@nabusmotors.com",
      ip: requestIp(req.headers),
      userAgent: req.headers.get("user-agent"),
    });
    return NextResponse.json({ ok: false, message: "Invalid email or password." }, { status: 401 });
  }

  const ownerAuth = {
    type: "owner" as const,
    name: "Owner",
    email: process.env.OWNER_EMAIL ?? "owner@nabusmotors.com",
    role: "owner" as const,
  };

  const res = NextResponse.json({ ok: true, redirect: adminDashboardPath() });
  res.cookies.set(ADMIN_COOKIE, expected, authSessionCookieOptions(60 * 60 * 12));
  res.cookies.set(PLATFORM_USER_COOKIE, "", clearAuthSessionCookieOptions());

  await logPlatformActivity(ownerAuth, "login");
  enqueueAuditLog({
    action: "login",
    success: true,
    actor: ownerAuth,
    targetType: "platform_session",
    request: req,
  });
  schedulePlatformLoginAlert({
    name: ownerAuth.name,
    email: ownerAuth.email,
    role: ownerAuth.role,
    ip: requestIp(req.headers),
    userAgent: req.headers.get("user-agent"),
  });
  return res;
}
