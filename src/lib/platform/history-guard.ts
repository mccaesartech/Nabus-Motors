import { adminLoginPath } from "@/lib/admin/paths";
import { platformDashboardPath } from "@/lib/platform/paths";
import { isAdminAppPath, isAdminPlatformPath } from "@/lib/pwa/routes";

const ACTIVE_KEY = "tg-platform-history-active";
const EXIT_OK_KEY = "tg-platform-history-exit-ok";
const RETURN_PATH_KEY = "tg-platform-history-return";

function canUseSessionStorage(): boolean {
  try {
    if (typeof sessionStorage === "undefined") return false;
    const probe = "__tg_platform_history_probe__";
    sessionStorage.setItem(probe, "1");
    sessionStorage.removeItem(probe);
    return true;
  } catch {
    return false;
  }
}

function isSafePlatformReturnPath(pathname: string): boolean {
  if (!pathname.startsWith("/") || pathname.startsWith("//")) return false;
  return isAdminPlatformPath(pathname);
}

/** Mark an authenticated platform workspace session for Back-button hygiene. */
export function armPlatformHistoryGuard(pathname: string): void {
  if (!canUseSessionStorage()) return;
  sessionStorage.setItem(ACTIVE_KEY, "1");
  sessionStorage.removeItem(EXIT_OK_KEY);
  rememberPlatformHistoryPath(pathname);
}

/** Keep the latest in-platform URL so accidental Back can return here. */
export function rememberPlatformHistoryPath(pathname: string): void {
  if (!canUseSessionStorage()) return;
  if (!isSafePlatformReturnPath(pathname)) return;
  sessionStorage.setItem(RETURN_PATH_KEY, pathname);
}

/**
 * Allow leaving the platform into the customer UI (View site / logout).
 * Clears the active guard so Back no longer bounces into admin.
 */
export function allowPlatformPublicExit(): void {
  if (!canUseSessionStorage()) return;
  sessionStorage.setItem(EXIT_OK_KEY, "1");
  sessionStorage.removeItem(ACTIVE_KEY);
}

/** Drop all platform history-guard state (logout / login page). */
export function clearPlatformHistoryGuard(): void {
  if (!canUseSessionStorage()) return;
  sessionStorage.removeItem(ACTIVE_KEY);
  sessionStorage.removeItem(EXIT_OK_KEY);
  sessionStorage.removeItem(RETURN_PATH_KEY);
}

export function getPlatformHistoryReturnPath(): string {
  if (!canUseSessionStorage()) return platformDashboardPath();
  const stored = sessionStorage.getItem(RETURN_PATH_KEY);
  if (stored && isSafePlatformReturnPath(stored)) return stored;
  return platformDashboardPath();
}

/**
 * When an armed platform session accidentally lands on a customer page (browser Back),
 * return the path to restore. Returns null when no bounce is needed.
 */
export function getPlatformHistoryBounceTarget(pathname: string): string | null {
  if (!canUseSessionStorage()) return null;
  if (sessionStorage.getItem(ACTIVE_KEY) !== "1") return null;
  if (sessionStorage.getItem(EXIT_OK_KEY) === "1") return null;

  // Still inside admin/platform workspace — keep normal in-app Back.
  if (isAdminPlatformPath(pathname)) return null;

  // Login URL while a platform session is armed: treat as accidental Back, not logout.
  if (pathname === adminLoginPath() || pathname === `${adminLoginPath()}/`) {
    return getPlatformHistoryReturnPath();
  }

  // Any other admin path (rare) stays put; only bounce off customer-facing routes.
  if (isAdminAppPath(pathname)) return null;

  return getPlatformHistoryReturnPath();
}
