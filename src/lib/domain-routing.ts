import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { PRODUCTION_PUBLIC_SITE_URL } from "@/lib/site-url";

const DEFAULT_AUTO_DIVISION_HOSTS = [
  "truegoshenauto.com",
  "www.truegoshenauto.com",
  "truegoshenauto.vercel.app",
  "auto.truegoshen.com",
];

/** Auto section paths served at `/auto/*` on the main domain; short paths on the auto host. */
const AUTO_SHORT_PATH_SEGMENTS = new Set([
  "inventory",
  "buy",
  "sell",
  "financing",
  "garage",
  "spare-parts",
  "parts",
]);

const PASSTHROUGH_PREFIXES = ["/api", "/platform", "/admin", "/_next", "/auto"];

export function getAutoDivisionHosts(): string[] {
  const env = process.env.AUTO_DIVISION_HOSTS?.trim();
  if (env) {
    return env
      .split(",")
      .map((host) => host.trim().toLowerCase())
      .filter(Boolean);
  }
  return DEFAULT_AUTO_DIVISION_HOSTS;
}

export function isAutoDivisionHost(hostname: string): boolean {
  const normalized = hostname.toLowerCase().split(":")[0];
  if (normalized.includes("truegoshenauto")) return true;
  return getAutoDivisionHosts().includes(normalized);
}

function shouldPassthrough(pathname: string): boolean {
  return PASSTHROUGH_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  );
}

function emergencyKeepsVercelHost(hostname: string): boolean {
  const raw = process.env.PUBLIC_SITE_URL_EMERGENCY_FALLBACK?.trim();
  if (!raw?.startsWith("https://")) return false;
  try {
    return new URL(raw).hostname.toLowerCase() === hostname;
  } catch {
    return false;
  }
}

/**
 * Send every production Vercel deployment host (aliases + *.vercel.app previews)
 * to the paid custom domain so customer polls, OAuth, and SW traffic never stay
 * on vercel.app. Includes API and `/serwist/sw.js` (cross-host 308 strips auth).
 *
 * Skips only `/_next/*` asset paths and an explicit emergency vercel fallback host.
 */
export function resolveLegacyVercelHostRedirect(
  req: NextRequest
): NextResponse | null {
  const hostname = (req.headers.get("host") ?? "").toLowerCase().split(":")[0];
  if (!hostname.endsWith(".vercel.app")) return null;
  if (emergencyKeepsVercelHost(hostname)) return null;

  const { pathname, search } = req.nextUrl;
  if (pathname.startsWith("/_next/")) return null;

  const dest = new URL(`${pathname}${search}`, PRODUCTION_PUBLIC_SITE_URL);
  return NextResponse.redirect(dest, 308);
}

/**
 * On auto-division hosts, send visitors straight to the Auto marketplace:
 * `/` → `/auto`, `/inventory` → `/auto/inventory`, etc.
 */
export function resolveAutoDivisionRedirect(req: NextRequest): NextResponse | null {
  const hostname = req.headers.get("host") ?? "";
  if (!isAutoDivisionHost(hostname)) return null;

  // *.vercel.app auto hosts are already redirected to www above.
  if (hostname.toLowerCase().split(":")[0].endsWith(".vercel.app")) return null;

  const { pathname, search } = req.nextUrl;
  if (shouldPassthrough(pathname) || pathname.includes(".")) return null;

  if (pathname === "/") {
    return NextResponse.redirect(new URL(`/auto${search}`, req.url));
  }

  const firstSegment = pathname.slice(1).split("/")[0];
  if (firstSegment && AUTO_SHORT_PATH_SEGMENTS.has(firstSegment)) {
    return NextResponse.redirect(new URL(`/auto${pathname}${search}`, req.url));
  }

  return null;
}
