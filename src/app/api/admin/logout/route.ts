import { NextResponse } from "next/server";
import { ADMIN_COOKIE, adminLoginPath } from "@/lib/admin/config";

export async function POST() {
  const res = NextResponse.json({ ok: true, redirect: adminLoginPath() });
  res.cookies.set(ADMIN_COOKIE, "", { httpOnly: true, path: "/", maxAge: 0 });
  return res;
}
