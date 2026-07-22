export const PRODUCTION_PUBLIC_SITE_URL = "https://truegoshen.vercel.app";
const PRODUCTION_AUTO_SITE_URL = "https://truegoshen.vercel.app";
const DEV_LOCALHOST_URL = "http://localhost:3000";
const LEGACY_AUTO_DEPLOYMENT_HOSTS = new Set(["truegoshenauto.vercel.app"]);

function isLocalhostHostname(hostname: string): boolean {
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "[::1]";
}

function isLocalhostUrl(raw: string): boolean {
  try {
    return isLocalhostHostname(new URL(raw).hostname);
  } catch {
    return false;
  }
}

function isDevelopment(): boolean {
  return process.env.NODE_ENV === "development" && !process.env.VERCEL;
}

function normalizeOrigin(
  raw: string | undefined,
  fallback: string,
  allowLocalhost = isDevelopment()
): string {
  const trimmed = raw?.trim();
  if (!trimmed) return fallback;

  if (allowLocalhost && isLocalhostUrl(trimmed)) {
    try {
      return new URL(trimmed).origin;
    } catch {
      return DEV_LOCALHOST_URL;
    }
  }

  if (!trimmed.startsWith("https://")) return fallback;

  try {
    const origin = new URL(trimmed).origin;
    if (!allowLocalhost && isLocalhostUrl(origin)) return fallback;
    return origin;
  } catch {
    return fallback;
  }
}

/** Canonical public site URL (corporate HQ) for metadata, invites, and emails. */
export function resolvePublicSiteUrl(
  configuredUrl: string | undefined,
  development = false
): string {
  const fallback = development ? DEV_LOCALHOST_URL : PRODUCTION_PUBLIC_SITE_URL;
  const origin = normalizeOrigin(configuredUrl, fallback, development);

  if (!development && LEGACY_AUTO_DEPLOYMENT_HOSTS.has(new URL(origin).hostname)) {
    return PRODUCTION_PUBLIC_SITE_URL;
  }

  return origin;
}

export function getPublicSiteUrl(): string {
  return resolvePublicSiteUrl(process.env.NEXT_PUBLIC_SITE_URL, isDevelopment());
}

/**
 * Direct Auto Division entry URL (truegoshen.vercel.app and custom domains).
 * Never returns localhost outside local development.
 */
export function getAutoSiteUrl(): string {
  if (isDevelopment()) {
    const explicit = process.env.NEXT_PUBLIC_AUTO_SITE_URL?.trim();
    if (explicit) {
      return normalizeOrigin(explicit, DEV_LOCALHOST_URL);
    }
    return DEV_LOCALHOST_URL;
  }

  const explicit = process.env.NEXT_PUBLIC_AUTO_SITE_URL?.trim();
  if (explicit && !isLocalhostUrl(explicit)) {
    return normalizeOrigin(explicit, PRODUCTION_AUTO_SITE_URL);
  }

  const vercelProduction = process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim();
  if (vercelProduction) {
    return normalizeOrigin(`https://${vercelProduction}`, PRODUCTION_AUTO_SITE_URL);
  }

  const vercelUrl = process.env.VERCEL_URL?.trim();
  if (vercelUrl) {
    return normalizeOrigin(`https://${vercelUrl}`, PRODUCTION_AUTO_SITE_URL);
  }

  return PRODUCTION_AUTO_SITE_URL;
}

/** Alias for getAutoSiteUrl — used by auth/email helpers. */
export const getSiteUrl = getAutoSiteUrl;
