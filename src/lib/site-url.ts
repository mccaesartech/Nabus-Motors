/**
 * Canonical public origin for production (invites, emails, metadata).
 * Prefer NEXT_PUBLIC_SITE_URL in Vercel; this is only the unset/invalid fallback.
 * Requires healthy Namecheap DNS — see LAUNCH_DOMAIN_CUTOVER.md (and docs/domain-cutover.md).
 *
 * Emergency only: set PUBLIC_SITE_URL_EMERGENCY_FALLBACK=https://truegoshen.vercel.app
 * while custom DNS is broken. Do not leave that set for launch.
 */
export const PRODUCTION_PUBLIC_SITE_URL = "https://www.nabusmotors.com";
const PRODUCTION_AUTO_SITE_URL = "https://www.nabusmotors.com";
const DEV_LOCALHOST_URL = "http://localhost:3000";
/** Known legacy / temporary Vercel hostnames — normalize to the canonical custom domain. */
const NON_CANONICAL_PUBLIC_HOSTS = new Set([
  "nabus-motors.vercel.app",
  "nabusmotors.vercel.app",
]);

function isNonCanonicalPublicHost(hostname: string): boolean {
  const host = hostname.toLowerCase();
  return NON_CANONICAL_PUBLIC_HOSTS.has(host) || host.endsWith(".vercel.app");
}

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

function emergencyPublicSiteUrl(): string | null {
  const raw = process.env.PUBLIC_SITE_URL_EMERGENCY_FALLBACK?.trim();
  if (!raw?.startsWith("https://")) return null;
  try {
    const origin = new URL(raw).origin;
    if (isLocalhostUrl(origin)) return null;
    return origin;
  } catch {
    return null;
  }
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
  const emergency = !development ? emergencyPublicSiteUrl() : null;
  const fallback = development
    ? DEV_LOCALHOST_URL
    : emergency ?? PRODUCTION_PUBLIC_SITE_URL;
  const origin = normalizeOrigin(configuredUrl, fallback, development);

  if (!development) {
    if (emergency) return emergency;
    const hostname = new URL(origin).hostname;
    if (isNonCanonicalPublicHost(hostname)) {
      return PRODUCTION_PUBLIC_SITE_URL;
    }
  }

  return origin;
}

export function getPublicSiteUrl(): string {
  return resolvePublicSiteUrl(process.env.NEXT_PUBLIC_SITE_URL, isDevelopment());
}

/**
 * Direct Auto Division entry URL (custom domain; never prefer *.vercel.app for public links).
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

  const emergency = emergencyPublicSiteUrl();
  if (emergency) return emergency;

  const explicit = process.env.NEXT_PUBLIC_AUTO_SITE_URL?.trim();
  if (explicit && !isLocalhostUrl(explicit)) {
    const origin = normalizeOrigin(explicit, PRODUCTION_AUTO_SITE_URL);
    const hostname = new URL(origin).hostname;
    if (isNonCanonicalPublicHost(hostname)) {
      return PRODUCTION_AUTO_SITE_URL;
    }
    return origin;
  }

  return PRODUCTION_AUTO_SITE_URL;
}

/** Alias for getAutoSiteUrl — used by auth/email helpers. */
export const getSiteUrl = getAutoSiteUrl;

/**
 * Browser API URL for customer fetches. Localhost keeps relative paths;
 * production always uses the canonical www origin so polls never depend on a
 * cross-host 308 from *.vercel.app (which strips Authorization → 401).
 */
export function resolveCustomerApiUrl(path: string): string {
  const normalized = path.startsWith("/") ? path : `/${path}`;
  if (typeof window === "undefined") return normalized;

  const hostname = window.location.hostname.toLowerCase();
  if (
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname === "[::1]"
  ) {
    return normalized;
  }

  return `${getPublicSiteUrl()}${normalized}`;
}
