/**
 * Pure maintenance routing rules — safe for unit tests and Edge proxy.
 * Customer/anonymous traffic is blocked when maintenance is on.
 * Authenticated platform admins bypass; exempt paths always pass.
 */

export type MaintenanceBlockInput = {
  pathname: string;
  isPlatformAdmin: boolean;
  maintenanceOn: boolean;
};

/** Default visitor-facing message when DB/settings are unavailable. */
export const DEFAULT_MAINTENANCE_MESSAGE =
  "We are performing scheduled maintenance. Some features may be temporarily unavailable.";

/**
 * Paths that must remain reachable during maintenance
 * (admin login/dashboard entry, auth, health, cron, webhooks, the page itself).
 */
export function isMaintenanceExemptPath(pathname: string): boolean {
  if (!pathname) return false;

  const path = pathname.split("?")[0] || "/";

  if (path === "/maintenance" || path.startsWith("/maintenance/")) return true;

  if (path === "/admin" || path.startsWith("/admin/")) return true;
  if (path === "/platform" || path.startsWith("/platform/")) return true;

  if (path.startsWith("/api/admin")) return true;
  if (path.startsWith("/api/cron")) return true;
  if (path.startsWith("/api/health")) return true;
  if (path.startsWith("/api/whatsapp/webhook")) return true;

  if (path === "/auth/callback" || path.startsWith("/auth/")) return true;

  if (path.startsWith("/_next/")) return true;
  if (path === "/favicon.ico" || path === "/robots.txt" || path === "/sitemap.xml") {
    return true;
  }
  if (path === "/manifest.webmanifest" || path === "/manifest.json") return true;
  if (path.startsWith("/icons/") || path.startsWith("/images/")) return true;

  // Static file extensions (matcher usually excludes these; keep as belt-and-suspenders)
  if (/\.(?:svg|png|jpg|jpeg|gif|webp|ico|mp4|woff2?|ttf|css|js|map)$/i.test(path)) {
    return true;
  }

  return false;
}

export function isApiPath(pathname: string): boolean {
  const path = pathname.split("?")[0] || "/";
  return path === "/api" || path.startsWith("/api/");
}

/**
 * Whether this request should be blocked (redirect to /maintenance or API 503).
 */
export function shouldBlockRequest(
  pathname: string,
  isPlatformAdmin: boolean,
  maintenanceOn: boolean
): boolean {
  if (!maintenanceOn) return false;
  if (isPlatformAdmin) return false;
  if (isMaintenanceExemptPath(pathname)) return false;
  return true;
}

export function shouldBlockRequestFromInput(input: MaintenanceBlockInput): boolean {
  return shouldBlockRequest(input.pathname, input.isPlatformAdmin, input.maintenanceOn);
}
