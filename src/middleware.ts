import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { ADMIN_COOKIE, adminLoginPath } from "@/lib/admin/config";

async function expectedAdminToken(): Promise<string | null> {
  const password = process.env.ADMIN_PASSWORD;
  const secret = process.env.ADMIN_SECRET ?? "true-goshen-admin-secret";
  if (!password) return null;
  const data = new TextEncoder().encode(`${password}:${secret}`);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

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
