/** Platform routes live under /admin so the admin PWA scope (/admin) covers the full app. */
export const PLATFORM_PATH = "admin/platform";

export function platformPathPrefix() {
  return `/${PLATFORM_PATH}`;
}

export function platformDashboardPath() {
  return `${platformPathPrefix()}/dashboard`;
}

export function platformPath(segment: string) {
  return `${platformPathPrefix()}/${segment}`;
}

/** Legacy /platform/* URLs — redirected to /admin/platform/* in next.config. */
export const LEGACY_PLATFORM_PATH = "platform";

/** Canonical forced password-change destination for platform team accounts. */
export const PLATFORM_FORCED_PASSWORD_CHANGE_PATH = platformPath("account/security");

export function isPlatformForcedPasswordChangePath(pathname: string): boolean {
  const canonical = `${platformPathPrefix()}/account/security`;
  return (
    pathname === canonical ||
    pathname.startsWith(`${canonical}/`) ||
    pathname === "/platform/account/security" ||
    pathname.startsWith("/platform/account/security/")
  );
}

/** API routes allowed while must_change_password is active. */
export const PLATFORM_PASSWORD_CHANGE_ALLOWED_API_PREFIXES = [
  "/api/admin/change-password",
  "/api/admin/session",
  "/api/admin/logout",
] as const;

export function isApiAllowedDuringPasswordChange(pathname: string): boolean {
  return PLATFORM_PASSWORD_CHANGE_ALLOWED_API_PREFIXES.some((prefix) =>
    pathname.startsWith(prefix)
  );
}

export function platformForcedPasswordChangeRedirectUrl(required = true): string {
  return required
    ? `${PLATFORM_FORCED_PASSWORD_CHANGE_PATH}?required=1`
    : PLATFORM_FORCED_PASSWORD_CHANGE_PATH;
}
