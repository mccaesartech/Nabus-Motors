import { NextRequest, NextResponse } from "next/server";
import {
  ADMIN_COOKIE,
  adminDashboardPath,
  expectedAdminToken,
} from "@/lib/admin/config";

export async function POST(req: NextRequest) {
  const { password } = await req.json();
  const expected = expectedAdminToken();

  if (!expected || !process.env.ADMIN_PASSWORD) {
    return NextResponse.json(
      { ok: false, message: "Admin login is not configured on the server." },
      { status: 503 }
    );
  }

  if (password !== process.env.ADMIN_PASSWORD) {
    return NextResponse.json({ ok: false, message: "Invalid password." }, { status: 401 });
  }

  const res = NextResponse.json({ ok: true, redirect: adminDashboardPath() });
  res.cookies.set(ADMIN_COOKIE, expected, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 12,
  });
  return res;
}
