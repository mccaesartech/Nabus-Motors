/**
 * Shared HTTP security headers for Next.js headers() and src/proxy.ts.
 *
 * CSP is intentionally omitted here - it is issued per-request with a nonce
 * from src/proxy.ts (see docs/CSP.md and docs/SECURITY_HEADERS.md).
 *
 * COEP is omitted on purpose: require-corp / credentialless breaks many
 * third-party images (Cloudinary, Google avatars, inventory CDNs) and can
 * interfere with OAuth popup flows.
 */

export type SecurityHeader = { key: string; value: string };

/** HSTS preload-ready value after probing www, apex, and auth over HTTPS. */
export const HSTS_VALUE =
  "max-age=31536000; includeSubDomains; preload";

export const PERMISSIONS_POLICY_VALUE = [
  "accelerometer=()",
  "autoplay=(self)",
  "camera=()",
  "display-capture=()",
  "encrypted-media=(self)",
  "fullscreen=(self)",
  "geolocation=()",
  "gyroscope=()",
  "magnetometer=()",
  "microphone=()",
  "midi=()",
  "payment=()",
  "picture-in-picture=(self)",
  "publickey-credentials-get=(self)",
  "usb=()",
  "interest-cohort=()",
  "browsing-topics=()",
].join(", ");

/**
 * Non-CSP browser security headers applied site-wide.
 * Keep Cross-Origin-Opener-Policy at same-origin-allow-popups for Google OAuth.
 */
export const BASE_SECURITY_HEADERS: SecurityHeader[] = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Strict-Transport-Security", value: HSTS_VALUE },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: PERMISSIONS_POLICY_VALUE },
  {
    key: "Cross-Origin-Opener-Policy",
    value: "same-origin-allow-popups",
  },
  // Prefer CORP over COEP so third-party media keeps working.
  { key: "Cross-Origin-Resource-Policy", value: "same-origin" },
];

/** Apply base security headers onto a response (proxy redirects, maintenance, etc.). */
export function applyBaseSecurityHeaders(headers: Headers): void {
  for (const { key, value } of BASE_SECURITY_HEADERS) {
    headers.set(key, value);
  }
}
