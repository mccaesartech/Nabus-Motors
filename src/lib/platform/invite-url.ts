import { getPublicSiteUrl } from "@/lib/site-url";
import { platformPath } from "@/lib/platform/paths";

/**
 * Acceptance URL shared by invite emails, WhatsApp, and API `inviteLink`.
 * Always uses getPublicSiteUrl() so links track NEXT_PUBLIC_SITE_URL / fallback.
 */
export function buildPlatformInviteUrl(
  token: string,
  siteUrl = getPublicSiteUrl()
): string {
  const url = new URL(
    platformPath(`invite/${encodeURIComponent(token)}`),
    `${siteUrl}/`
  );
  return url.toString();
}
