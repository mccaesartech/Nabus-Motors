import { NextResponse } from "next/server";
import { ADMIN_COOKIE, PLATFORM_USER_COOKIE, adminLoginPath } from "@/lib/admin/config";
import { getPlatformAuth } from "@/lib/admin/auth";
import { logPlatformActivity } from "@/lib/platform/activity";

export async function POST() {
  const auth = await getPlatformAuth();
  if (auth) {
    await logPlatformActivity(auth, "logout");
  }

  const res = NextResponse.json({ ok: true, redirect: adminLoginPath() });
  res.cookies.set(ADMIN_COOKIE, "", { httpOnly: true, path: "/", maxAge: 0 });
  res.cookies.set(PLATFORM_USER_COOKIE, "", { httpOnly: true, path: "/", maxAge: 0 });
  return res;
}
