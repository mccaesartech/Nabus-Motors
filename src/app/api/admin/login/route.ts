import { NextRequest, NextResponse } from "next/server";
import {
  ADMIN_COOKIE,
  PLATFORM_USER_COOKIE,
  adminTokenForPassword,
  adminDashboardPath,
  expectedAdminToken,
  isAdminSessionSecretConfigured,
} from "@/lib/admin/config";
import { authenticatePlatformUser } from "@/lib/admin/auth";
import {
  buildPlatformSessionCookieValue,
  PLATFORM_SESSION_TTL_SEC,
} from "@/lib/platform/session";
import { logPlatformActivity } from "@/lib/platform/activity";
import { consumeRateLimit, requestIp } from "@/lib/security/rate-limit";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const password = typeof body.password === "string" ? body.password : "";
  const confirmPassword =
    typeof body.confirmPassword === "string" ? body.confirmPassword : undefined;

  if (!password) {
    return NextResponse.json({ ok: false, message: "Password is required." }, { status: 400 });
  }
  if (!isAdminSessionSecretConfigured()) {
    return NextResponse.json(
      { ok: false, message: "Login is not configured on the server." },
      { status: 503 }
    );
  }

  const rateLimit = consumeRateLimit(
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
    const result = await authenticatePlatformUser(email, password, confirmPassword);
    if (result.status === "needs_password_setup") {
      return NextResponse.json(
        {
          ok: false,
          needsPasswordSetup: true,
          message: "No password is set for this account yet. Create one now by entering it twice.",
        },
        { status: 409 }
      );
    }
    if (result.status === "password_setup_failed") {
      return NextResponse.json(
        { ok: false, needsPasswordSetup: true, message: result.message },
        { status: 400 }
      );
    }
    if (result.status !== "success") {
      return NextResponse.json({ ok: false, message: "Invalid email or password." }, { status: 401 });
    }

    const auth = result.auth;
    if (!auth.userId || !auth.passwordHash) {
      return NextResponse.json(
        { ok: false, message: "Account is not fully activated. Contact your administrator." },
        { status: 403 }
      );
    }

    const sessionValue = await buildPlatformSessionCookieValue(
      auth.userId,
      auth.role,
      auth.passwordHash
    );
    const res = NextResponse.json({ ok: true, redirect: adminDashboardPath() });
    res.cookies.set(PLATFORM_USER_COOKIE, sessionValue, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: PLATFORM_SESSION_TTL_SEC,
    });
    res.cookies.set(ADMIN_COOKIE, "", { httpOnly: true, path: "/", maxAge: 0 });

    await logPlatformActivity(auth, "login");
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
    return NextResponse.json({ ok: false, message: "Invalid email or password." }, { status: 401 });
  }

  const ownerAuth = {
    type: "owner" as const,
    name: "Owner",
    email: process.env.OWNER_EMAIL ?? "owner@truegoshenauto.com",
    role: "owner" as const,
  };

  const res = NextResponse.json({ ok: true, redirect: adminDashboardPath() });
  res.cookies.set(ADMIN_COOKIE, expected, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 12,
  });
  res.cookies.set(PLATFORM_USER_COOKIE, "", { httpOnly: true, path: "/", maxAge: 0 });

  await logPlatformActivity(ownerAuth, "login");
  return res;
}
