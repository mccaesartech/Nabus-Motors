import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { adminLoginPath, resolvedAdminPath } from "@/lib/admin/config";
import { resolvePlatformAuthFromRequest } from "@/lib/admin/platform-auth-request";
import {
  resolveAutoDivisionRedirect,
  resolveLegacyVercelHostRedirect,
} from "@/lib/domain-routing";
import {
  hasPermission,
  permissionForPath,
} from "@/lib/platform/permissions";
import {
  isApiAllowedDuringPasswordChange,
  isPlatformForcedPasswordChangePath,
  platformForcedPasswordChangeRedirectUrl,
  platformPathPrefix,
} from "@/lib/platform/paths";
import {
  getMaintenanceState,
  maintenanceApiPayload,
} from "@/lib/maintenance/state";
import { isApiPath, shouldBlockRequest } from "@/lib/maintenance/rules";
import {
  buildContentSecurityPolicy,
  createCspNonce,
} from "@/lib/security/csp";
import { applyBaseSecurityHeaders } from "@/lib/security/http-headers";

function isPlatformAdminApiPath(pathname: string) {
  if (!pathname.startsWith("/api/admin/")) return false;
  const publicPrefixes = [
    "/api/admin/login",
    "/api/admin/forgot-password",
    "/api/admin/reset-password",
    "/api/admin/invite/accept",
    "/api/admin/invite/validate",
    "/api/admin/backup-codes/login",
    "/api/admin/passkeys/login/",
    "/api/admin/health",
  ];
  return !publicPrefixes.some((prefix) => pathname.startsWith(prefix));
}

function isProtectedAdminPath(pathname: string) {
  const dashboardPrefix = `/${resolvedAdminPath()}/dashboard`;
  const platformPrefix = platformPathPrefix();
  return (
    pathname.startsWith(dashboardPrefix) ||
    pathname.startsWith(platformPrefix) ||
    pathname.startsWith("/platform")
  );
}

/** Canonical (/admin/platform/invite/…) and legacy (/platform/invite/…) shapes. */
function isInvitePath(pathname: string) {
  return (
    /^\/admin\/platform\/invite\/[^/]+$/.test(pathname) ||
    /^\/platform\/invite\/[^/]+$/.test(pathname)
  );
}

function canonicalInvitePathname(pathname: string) {
  if (pathname.startsWith("/admin/")) return pathname;
  return `/admin${pathname}`;
}

/**
 * Continue the request with a per-request CSP nonce so Next.js can stamp
 * framework scripts and the root layout can stamp the cache-recovery inline script.
 */
function nextWithCsp(
  req: NextRequest,
  mutate?: (response: NextResponse) => void
): NextResponse {
  const nonce = createCspNonce();
  const isDev = process.env.NODE_ENV === "development";
  const csp = buildContentSecurityPolicy({ nonce, isDev });

  const requestHeaders = new Headers(req.headers);
  requestHeaders.set("x-nonce", nonce);
  // Next reads the request CSP header to extract/apply the nonce during SSR.
  requestHeaders.set("Content-Security-Policy", csp);

  const response = NextResponse.next({
    request: { headers: requestHeaders },
  });
  applyBaseSecurityHeaders(response.headers);
  response.headers.set("Content-Security-Policy", csp);
  mutate?.(response);
  return response;
}

/** Attach base security headers to proxy-built responses (redirects / early exits). */
function withBaseSecurityHeaders(response: NextResponse): NextResponse {
  applyBaseSecurityHeaders(response.headers);
  return response;
}

export async function proxy(req: NextRequest) {
  const legacyHostRedirect = resolveLegacyVercelHostRedirect(req);
  if (legacyHostRedirect) return withBaseSecurityHeaders(legacyHostRedirect);

  const autoRedirect = resolveAutoDivisionRedirect(req);
  if (autoRedirect) return withBaseSecurityHeaders(autoRedirect);

  const { pathname } = req.nextUrl;

  // Bot CMS probes — not an app route; cheap 410 stops noisy 404/SSR work.
  if (
    pathname.startsWith("/wp-admin") ||
    pathname.startsWith("/wp-login") ||
    pathname === "/xmlrpc.php" ||
    pathname.startsWith("/wordpress")
  ) {
    return withBaseSecurityHeaders(
      new NextResponse(null, {
        status: 410,
        headers: { "Cache-Control": "public, max-age=86400" },
      })
    );
  }

  // Invite acceptance must stay public and set x-pathname for platform layout
  // (layout matches /admin/platform/invite/…; proxy historically only saw /platform/…).
  if (isInvitePath(pathname)) {
    return nextWithCsp(req, (response) => {
      response.headers.set("x-pathname", canonicalInvitePathname(pathname));
    });
  }

  // Enterprise maintenance gate — soft-fails off if settings are unavailable.
  // Platform admin sessions bypass; exempt paths (admin, auth, health, cron, webhooks) pass.
  const maintenance = await getMaintenanceState();
  let platformAuth: Awaited<ReturnType<typeof resolvePlatformAuthFromRequest>> | null = null;

  if (maintenance.enabled) {
    platformAuth = await resolvePlatformAuthFromRequest(req);
    const isPlatformAdmin = Boolean(platformAuth.authenticated && platformAuth.role);
    if (shouldBlockRequest(pathname, isPlatformAdmin, true)) {
      if (isApiPath(pathname)) {
        return withBaseSecurityHeaders(
          NextResponse.json(maintenanceApiPayload(maintenance.message), {
            status: 503,
            headers: {
              "Retry-After": "300",
              "Cache-Control": "no-store",
            },
          })
        );
      }
      const dest = req.nextUrl.clone();
      dest.pathname = "/maintenance";
      dest.search = "";
      return withBaseSecurityHeaders(NextResponse.redirect(dest));
    }
  }

  if (!isProtectedAdminPath(pathname) && !isPlatformAdminApiPath(pathname)) {
    return nextWithCsp(req);
  }

  const auth = platformAuth ?? (await resolvePlatformAuthFromRequest(req));
  if (!auth.authenticated || !auth.role) {
    if (isPlatformAdminApiPath(pathname)) {
      return withBaseSecurityHeaders(
        NextResponse.json({ ok: false, message: "Session expired. Please sign in again." }, { status: 401 })
      );
    }
    return withBaseSecurityHeaders(
      NextResponse.redirect(new URL(adminLoginPath(), req.url))
    );
  }

  if (
    auth.mustChangePassword &&
    !isPlatformForcedPasswordChangePath(pathname) &&
    !isApiAllowedDuringPasswordChange(pathname)
  ) {
    if (isPlatformAdminApiPath(pathname) || isApiPath(pathname)) {
      return withBaseSecurityHeaders(
        NextResponse.json(
          {
            ok: false,
            message: "You must set a new password before continuing.",
            mustChangePassword: true,
          },
          { status: 403 }
        )
      );
    }
    return withBaseSecurityHeaders(
      NextResponse.redirect(new URL(platformForcedPasswordChangeRedirectUrl(), req.url))
    );
  }

  const required = permissionForPath(pathname);
  if (required && !hasPermission(auth.role, required)) {
    return withBaseSecurityHeaders(
      NextResponse.redirect(new URL("/platform/dashboard", req.url))
    );
  }

  return nextWithCsp(req, (response) => {
    response.headers.set("x-pathname", pathname);
  });
}

export const config = {
  matcher: [
    /*
     * Auth/maintenance + CSP nonce must run on navigations (including prefetch).
     * Do not exclude prefetch — platform routes rely on this proxy for auth.
     * Skip static assets / Serwist SW files that never need a document CSP nonce.
     */
    "/((?!_next/static|_next/image|favicon.ico|serwist/|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|mp4)$).*)",
  ],
};
