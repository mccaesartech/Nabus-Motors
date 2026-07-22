import { getPublicSiteUrl } from "@/lib/site-url";
import { platformPath } from "@/lib/platform/paths";

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
