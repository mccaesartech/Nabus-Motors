import { NextResponse } from "next/server";
import {
  ADMIN_COOKIE,
  PLATFORM_USER_COOKIE,
  adminDashboardPath,
  isAdminSessionSecretConfigured,
} from "@/lib/admin/config";
import type { PlatformAuthContext } from "@/lib/admin/auth";
import { logPlatformActivity } from "@/lib/platform/activity";
import { normalizeRole } from "@/lib/platform/permissions";
import {
  buildPlatformSessionCookieValue,
  PLATFORM_SESSION_TTL_SEC,
} from "@/lib/platform/session";

type PlatformUserRow = {
  id: string;
  name: string;
  email: string;
  role: string;
  password_hash: string;
};

export async function buildPlatformLoginResponse(user: PlatformUserRow): Promise<NextResponse> {
  if (!isAdminSessionSecretConfigured()) {
    return NextResponse.json(
      { ok: false, message: "Server authentication is not configured." },
      { status: 503 }
    );
  }

  const sessionValue = await buildPlatformSessionCookieValue(
    user.id,
    normalizeRole(user.role),
    user.password_hash
  );

  const auth: PlatformAuthContext = {
    type: "user",
    userId: user.id,
    name: user.name,
    email: user.email,
    role: normalizeRole(user.role),
  };

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
