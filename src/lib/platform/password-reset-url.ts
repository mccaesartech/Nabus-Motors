import { getPublicSiteUrl } from "@/lib/site-url";
import { adminLoginPath } from "@/lib/admin/paths";

/** Staff password-reset links expire one hour after creation. */
export const PLATFORM_PASSWORD_RESET_TTL_MS = 60 * 60 * 1000;
export const PLATFORM_PASSWORD_RESET_EXPIRY_LABEL = "1 hour";

export function computePlatformPasswordResetExpiresAt(nowMs = Date.now()): string {
  return new Date(nowMs + PLATFORM_PASSWORD_RESET_TTL_MS).toISOString();
}

export function isPlatformPasswordResetExpired(
  expiresAt: string,
  nowMs = Date.now()
): boolean {
  return new Date(expiresAt).getTime() < nowMs;
}

/** Public URL for the staff reset form (`/admin/reset-password?token=…`). */
export function buildPlatformPasswordResetUrl(
  token: string,
  siteUrl = getPublicSiteUrl()
): string {
  const url = new URL(`${adminLoginPath()}/reset-password`, `${siteUrl}/`);
  url.searchParams.set("token", token);
  return url.toString();
}

export function buildPlatformForgotPasswordUrl(siteUrl = getPublicSiteUrl()): string {
  return new URL(`${adminLoginPath()}/forgot-password`, `${siteUrl}/`).toString();
}
