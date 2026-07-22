import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { adminLoginPath, resolvedAdminPath } from "@/lib/admin/config";
import { resolvePlatformAuthFromRequest } from "@/lib/admin/platform-auth-request";
import { resolveAutoDivisionRedirect } from "@/lib/domain-routing";
import {
  canViewFinance,
  hasPermission,
  permissionForPath,
} from "@/lib/platform/permissions";

function isProtectedAdminPath(pathname: string) {
  const dashboardPrefix = `/${resolvedAdminPath()}/dashboard`;
  return pathname.startsWith(dashboardPrefix) || pathname.startsWith("/platform");
}

function isInvitePath(pathname: string) {
  return /^\/platform\/invite\/[^/]+$/.test(pathname);
}

export async function proxy(req: NextRequest) {
  const autoRedirect = resolveAutoDivisionRedirect(req);
  if (autoRedirect) return autoRedirect;

  const { pathname } = req.nextUrl;

  if (!isProtectedAdminPath(pathname)) {
    return NextResponse.next();
  }

  if (isInvitePath(pathname)) {
    const response = NextResponse.next();
    response.headers.set("x-pathname", pathname);
    return response;
  }

  const auth = await resolvePlatformAuthFromRequest(req);
  if (!auth.authenticated || !auth.role) {
    return NextResponse.redirect(new URL(adminLoginPath(), req.url));
  }

  const required = permissionForPath(pathname);
  if (required && !hasPermission(auth.role, required)) {
    if (required === "finance" || !canViewFinance(auth.role)) {
      return NextResponse.redirect(new URL("/platform/dashboard", req.url));
    }
    return NextResponse.redirect(new URL("/platform/dashboard", req.url));
  }

  const response = NextResponse.next();
  response.headers.set("x-pathname", pathname);
  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|mp4)$).*)",
  ],
};
