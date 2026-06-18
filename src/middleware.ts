import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import {
  ADMIN_COOKIE,
  adminLoginPath,
  expectedAdminToken,
} from "@/lib/admin/config";

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (!pathname.startsWith("/tg-console-8f2k/dashboard")) {
    return NextResponse.next();
  }

  const token = req.cookies.get(ADMIN_COOKIE)?.value;
  const expected = await expectedAdminToken();

  if (!token || !expected || token !== expected) {
    return NextResponse.redirect(new URL(adminLoginPath(), req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/tg-console-8f2k/dashboard/:path*"],
};
