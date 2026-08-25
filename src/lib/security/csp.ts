/**
 * Content-Security-Policy helpers for production hardening.
 *
 * Nonce-based script-src is applied per-request from `src/proxy.ts` so Next.js
 * can attach the nonce to framework scripts. See `docs/CSP.md`.
 */

export type CspBuildOptions = {
  nonce: string;
  /** Defaults to `process.env.NODE_ENV === "development"`. */
  isDev?: boolean;
};

/** Cryptographically random base64 nonce (per Next.js CSP guide). */
export function createCspNonce(): string {
  return Buffer.from(crypto.randomUUID()).toString("base64");
}

/**
 * Build an enforce-mode CSP string.
 *
 * - Production: no `unsafe-inline` / `unsafe-eval` in script-src (nonce + strict-dynamic).
 * - Development: `unsafe-eval` only (React/Next HMR / debug stacks).
 * - style-src keeps `unsafe-inline` for React style props / Tailwind / Next.
 */
export function buildContentSecurityPolicy(options: CspBuildOptions): string {
  const isDev =
    options.isDev ?? process.env.NODE_ENV === "development";
  const nonce = options.nonce.trim();
  if (!nonce) {
    throw new Error("CSP nonce must be a non-empty string");
  }

  const scriptSrc = [
    "'self'",
    `'nonce-${nonce}'`,
    "'strict-dynamic'",
    // Ignored by browsers that honor strict-dynamic; kept as a legacy fallback.
    "https://*.sentry.io",
    "https://*.vercel-scripts.com",
  ];
  if (isDev) {
    scriptSrc.push("'unsafe-eval'");
  }

  const directives = [
    "default-src 'self'",
    `script-src ${scriptSrc.join(" ")}`,
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    [
      "img-src 'self' data: blob:",
      "https://*.supabase.co",
      "https://auth.truegoshengh.com",
      "https://*.googleusercontent.com",
      "https://lh3.googleusercontent.com",
      "https://res.cloudinary.com",
      "https://*.cloudinary.com",
      "https://images.unsplash.com",
      "https://images.pexels.com",
      "https://upload.wikimedia.org",
      "https://ui-avatars.com",
      "https://i.imgur.com",
      "https://*.imgur.com",
      "https://i.pinimg.com",
      "https://*.pinimg.com",
      "https://images.craigslist.org",
      "https://*.fbcdn.net",
      "https://api.qrserver.com",
      "https://*.sentry.io",
    ].join(" "),
    "font-src 'self' data: https://fonts.gstatic.com",
    [
      "connect-src 'self'",
      "https://*.supabase.co",
      "wss://*.supabase.co",
      "https://auth.truegoshengh.com",
      "wss://auth.truegoshengh.com",
      "https://*.ingest.sentry.io",
      "https://*.ingest.us.sentry.io",
      "https://*.sentry.io",
      "https://api.qrserver.com",
      "https://accounts.google.com",
      "https://oauth2.googleapis.com",
      "https://*.googleapis.com",
      "https://*.google.com",
      "https://vitals.vercel-insights.com",
      "https://*.vercel-insights.com",
      "https://va.vercel-scripts.com",
      "https://*.vercel-scripts.com",
      "https://res.cloudinary.com",
      "https://api.cloudinary.com",
    ].join(" "),
    [
      "frame-src 'self' blob:",
      "https://maps.google.com",
      "https://www.google.com",
      "https://www.youtube.com",
      "https://www.youtube-nocookie.com",
      "https://player.vimeo.com",
    ].join(" "),
    "worker-src 'self' blob:",
    "child-src 'self' blob:",
    "media-src 'self' blob: https:",
    "manifest-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "frame-ancestors 'none'",
    "form-action 'self'",
  ];

  if (!isDev) {
    directives.push("upgrade-insecure-requests");
  }

  return directives.join("; ");
}