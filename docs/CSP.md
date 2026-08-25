# Content Security Policy (CSP)

Enforce-mode CSP for https://www.truegoshengh.com. Policy is generated
**per request** in `src/proxy.ts` with a fresh script nonce (Next.js App Router
pattern   see `node_modules/next/dist/docs/01-app/02-guides/content-security-policy.md`).

Static CSP was removed from `next.config.ts` so browsers do not receive two
policies (multiple CSP headers are enforced as an intersection).

---

## Old CSP (pre-hardening, from `next.config.ts`)

```
default-src 'self';
script-src 'self' 'unsafe-inline' 'unsafe-eval' https://*.sentry.io https://*.vercel-scripts.com;
style-src 'self' 'unsafe-inline' https://fonts.googleapis.com;
img-src 'self' data: blob: https:;
font-src 'self' data: https://fonts.gstatic.com;
connect-src 'self' https://*.supabase.co https://auth.truegoshengh.com wss://*.supabase.co https://*.sentry.io https://api.resend.com https://api.qrserver.com https://*.googleapis.com https://*.google.com;
frame-ancestors 'none';
base-uri 'self';
form-action 'self';
object-src 'none'
```

Problems:

- `script-src` allowed `'unsafe-inline'` and `'unsafe-eval'` in production
- `img-src https:` was an open HTTPS allowlist
- Missing `upgrade-insecure-requests`, `worker-src`, `frame-src`, Sentry ingest hosts
- Inline cache-recovery script in root layout had no nonce/hash

---

## New CSP (production shape)

`{nonce}` is a per-request base64 value from `createCspNonce()`.

```
default-src 'self';
script-src 'self' 'nonce-{nonce}' 'strict-dynamic' https://*.sentry.io https://*.vercel-scripts.com;
style-src 'self' 'unsafe-inline' https://fonts.googleapis.com;
img-src 'self' data: blob: https://*.supabase.co https://auth.truegoshengh.com https://*.googleusercontent.com https://lh3.googleusercontent.com https://res.cloudinary.com https://*.cloudinary.com https://images.unsplash.com https://images.pexels.com https://upload.wikimedia.org https://ui-avatars.com https://i.imgur.com https://*.imgur.com https://i.pinimg.com https://*.pinimg.com https://images.craigslist.org https://*.fbcdn.net https://api.qrserver.com https://*.sentry.io;
font-src 'self' data: https://fonts.gstatic.com;
connect-src 'self' https://*.supabase.co wss://*.supabase.co https://auth.truegoshengh.com wss://auth.truegoshengh.com https://*.ingest.sentry.io https://*.ingest.us.sentry.io https://*.sentry.io https://api.qrserver.com https://accounts.google.com https://oauth2.googleapis.com https://*.googleapis.com https://*.google.com https://vitals.vercel-insights.com https://*.vercel-insights.com https://va.vercel-scripts.com https://*.vercel-scripts.com https://res.cloudinary.com https://api.cloudinary.com;
frame-src 'self' blob: https://maps.google.com https://www.google.com https://www.youtube.com https://www.youtube-nocookie.com https://player.vimeo.com;
worker-src 'self' blob:;
child-src 'self' blob:;
media-src 'self' blob: https:;
manifest-src 'self';
object-src 'none';
base-uri 'self';
frame-ancestors 'none';
form-action 'self';
upgrade-insecure-requests
```

### Development-only differences

- `script-src` also includes `'unsafe-eval'` (React/Next debug / HMR)
- `upgrade-insecure-requests` is omitted (local `http://`)

---

## Changes made

| Area | Change |
| --- | --- |
| `src/lib/security/csp.ts` | Shared CSP builder + nonce helper |
| `src/proxy.ts` | Issues nonce, sets request + response `Content-Security-Policy`, sets `x-nonce` for SSR |
| `src/app/layout.tsx` | Async layout reads `x-nonce` and stamps the cache-recovery `<script>` |
| `next.config.ts` | Removed static CSP header (other security headers unchanged) |
| `src/lib/security/__tests__/csp.test.ts` | Locks production vs development directive rules |
| Docs | This file; pointer in `SECURITY_CHECKS.md` |

Also:

- Removed production `'unsafe-inline'` / `'unsafe-eval'` from `script-src`
- Tightened `img-src` away from open `https:`
- Added `frame-src` for Maps / YouTube / Vimeo / print `blob:` iframes
- Added `worker-src` / `child-src` for Serwist + `html2pdf` / blob workers
- Added Sentry ingest + Vercel Insights connect hosts
- Dropped browser `connect-src` for `api.resend.com` (server-side only)
- Kept `Cross-Origin-Opener-Policy: same-origin-allow-popups` for OAuth-friendly popups

---

## Remaining exceptions (and why)

| Exception | Why it remains |
| --- | --- |
| `style-src 'unsafe-inline'` | React `style={{& }}` props, Next/Tailwind runtime style attributes, and print shells. Style attributes cannot take nonces; removing this breaks large parts of the UI. Prefer moving new styles to classes/CSS modules over expanding inline styles. |
| `script-src` host fallbacks (`*.sentry.io`, `*.vercel-scripts.com`) | Ignored when the browser honors `'strict-dynamic'`; kept for older browsers that do not. |
| `media-src &  https:` | Hero / CMS video sources may be arbitrary HTTPS URLs. |
| `img-src` CDN allowlist | Matches `next.config` `images.remotePatterns` inventory sources + avatars/QR. |
| Dynamic rendering for root layout | Nonce CSP requires reading request headers; root `revalidate` ISR is incompatible with per-request nonces (Next.js CSP guide). |
| Print popup HTML | `document-shell` writes HTML (including a small print script) into a same-origin/`blob` iframe/popup. Parent page CSP does not fully govern that document; keep XSS hygiene in print HTML. |

Google Sign-In uses Supabase OAuth **redirect** (no GSI client script), so `accounts.google.com` is allowlisted under `connect-src`, not `script-src`.

---

## How to verify

### 1. Response header

```bash
curl -sI https://www.truegoshengh.com | findstr /I "content-security-policy"
```

Expect:

- `nonce-& ` present in `script-src`
- **no** `'unsafe-inline'` / `'unsafe-eval'` inside `script-src`
- `upgrade-insecure-requests`, `object-src 'none'`, `frame-ancestors 'none'`

### 2. Browser console smoke

1. Open https://www.truegoshengh.com   no CSP violation errors for Next bundles / Serwist.
2. Customer **Continue with Google** ’! redirects via `auth.truegoshengh.com` / Supabase ’! back to `/auth/callback`.
3. Confirm service worker registers (`/serwist/sw.js`) on the canonical host (not `*.vercel.app`).

### 3. Mozilla Observatory

Scan https://www.truegoshengh.com at [Observatory](https://developer.mozilla.org/en-US/observatory). Prefer **enforce** mode (this deploy); do not leave Report-Only in production unless rolling back.

### 4. Automated

```bash
npm run test:security
npm run typecheck
```

---

## Rollback

1. Restore the static CSP block in `next.config.ts` headers (git history).
2. Revert `src/proxy.ts` CSP wiring and layout `nonce` / `headers()` usage.
3. Redeploy.


---

## Related

Full header matrix (HSTS, CORP, COOP, Permissions-Policy) and Observatory notes: [SECURITY_HEADERS.md](./SECURITY_HEADERS.md).
