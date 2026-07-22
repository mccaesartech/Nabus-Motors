import { after, NextResponse } from "next/server";
import { ADMIN_COOKIE, PLATFORM_USER_COOKIE, adminLoginPath } from "@/lib/admin/config";
import { getPlatformAuth } from "@/lib/admin/auth";
import { logPlatformActivity } from "@/lib/platform/activity";

export function POST() {
  const res = NextResponse.json(
    { ok: true, redirect: adminLoginPath() },
    { headers: { "Cache-Control": "no-store" } }
  );
  res.cookies.set(ADMIN_COOKIE, "", { httpOnly: true, path: "/", maxAge: 0 });
  res.cookies.set(PLATFORM_USER_COOKIE, "", { httpOnly: true, path: "/", maxAge: 0 });

  // Logging must never delay or prevent the cookie-clearing response.
  after(async () => {
    try {
      const auth = await getPlatformAuth();
      if (auth) await logPlatformActivity(auth, "logout");
    } catch (error) {
      console.error("Platform logout activity logging failed:", error);
    }
  });

  return res;
}
