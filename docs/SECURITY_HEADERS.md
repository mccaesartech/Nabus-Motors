# Security headers (production)

Production host: https://www.truegoshengh.com
Auth host: https://auth.truegoshengh.com
Last audited: 2026-08-04

This document covers browser security headers (CSP, HSTS, COOP/CORP, framing, MIME sniffing, Permissions-Policy). Nonce CSP details live in [CSP.md](./CSP.md). Automated header unit tests: `src/lib/security/__tests__/http-headers.test.ts` and `csp.test.ts`.

## Probe results (subdomains)

| Host | HTTPS | Notes |
|------|-------|-------|
| www.truegoshengh.com | OK | Canonical app; Vercel |
| truegoshengh.com (apex) | OK | 308 -> https://www.truegoshengh.com/ |
| auth.truegoshengh.com | OK | Supabase Auth custom domain via Cloudflare; already sends HSTS with preload |
| http://www / http://apex | Redirect to HTTPS | Vercel |
| http://auth.truegoshengh.com | 404 (no HTTPS redirect) | Cloudflare/Supabase edge; HTTPS works. Caveat for official HSTS preload list submission (see below). |

## Before / after (www)

### Before this hardening pass (live, pre-deploy)

| Header | Value |
|--------|-------|
| Content-Security-Policy | Nonce + strict-dynamic; **no** script unsafe-inline / unsafe-eval (from prior CSP pass) |
| Strict-Transport-Security | max-age=63072000; includeSubDomains (**no** preload) |
| Cross-Origin-Opener-Policy | same-origin-allow-popups |
| Cross-Origin-Resource-Policy | *(missing)* |
| Cross-Origin-Embedder-Policy | *(missing — still omitted)* |
| Permissions-Policy | camera=(), microphone=(), geolocation=() |
| X-Frame-Options | DENY |
| X-Content-Type-Options | nosniff |
| Referrer-Policy | strict-origin-when-cross-origin |

Mozilla Observatory (MDN API v2) before this pass history: **B+ (80)** -> **A+ (110)** after the nonce-CSP deploy. Recommendation remaining: add HSTS `preload`; CORP not implemented.

### After (intended / post-deploy)

| Header | Value |
|--------|-------|
| Content-Security-Policy | Unchanged shape from [CSP.md](./CSP.md) — nonce script-src, style-src keeps unsafe-inline |
| Strict-Transport-Security | max-age=31536000; includeSubDomains; preload |
| Cross-Origin-Opener-Policy | same-origin-allow-popups (OAuth popups) |
| Cross-Origin-Resource-Policy | same-origin |
| Cross-Origin-Embedder-Policy | **Omitted** (see rationale) |
| Permissions-Policy | Expanded deny/allow list (camera/mic/geo/payment/usb/topics off; autoplay/fullscreen/PiP/passkeys self) |
| X-Frame-Options | DENY |
| X-Content-Type-Options | nosniff |
| Referrer-Policy | strict-origin-when-cross-origin |

## Implementation map

| Area | File |
|------|------|
| Shared non-CSP headers | `src/lib/security/http-headers.ts` |
| next.config site-wide headers | `next.config.ts` (spreads `BASE_SECURITY_HEADERS`) |
| Per-request CSP + header mirror on navigations | `src/proxy.ts` |
| CSP builder | `src/lib/security/csp.ts` |

Do **not** re-add a static CSP in `next.config.ts` — multiple CSP headers intersect and can break the nonce policy.

## COEP decision

`Cross-Origin-Embedder-Policy: require-corp` or `credentialless` is **not** set.

Why: the site loads many cross-origin images/media (Cloudinary, Google user content, inventory CDNs, Unsplash/Pexels, etc.) and uses OAuth-friendly popups. COEP would require CORP/CORS on those third parties and has historically broken LCP images and auth UX here. CORP `same-origin` on *our* responses still limits how other sites can reuse our documents/assets without opting into a full cross-origin isolation world.

## HSTS / preload caveats

Enabled on the Next/Vercel app:

```
Strict-Transport-Security: max-age=31536000; includeSubDomains; preload
```

Rationale for includeSubDomains + preload:

- www, apex, and auth all present valid HTTPS.
- apex and www redirect HTTP -> HTTPS.
- auth already advertises HSTS with includeSubDomains; preload on HTTPS responses.

Caveats before submitting to https://hstspreload.org/:

1. `http://auth.truegoshengh.com` currently returns **404 without an HTTPS redirect** (Cloudflare/Supabase). Official preload eligibility usually requires HTTP->HTTPS redirects on the base domain and all subdomains that receive traffic.
2. HSTS with `includeSubDomains` applies to **all** future subdomains of `truegoshengh.com`. Only create HTTPS-capable subdomains.
3. Preload is effectively sticky after browser list inclusion — remove only via the preload removal process.

If auth HTTP redirect cannot be fixed upstream, keep the header (browsers still honor it on first HTTPS visit) but **do not submit** to the preload list until auth HTTP redirects correctly.

## CSP exceptions (still required)

| Exception | Why it remains |
|-----------|----------------|
| style-src 'unsafe-inline' | React style props, Next/Tailwind runtime styles, print shells. Style attributes cannot take nonces. Prefer moving new styles to classes/CSS modules. |
| script-src host fallbacks (*.sentry.io, *.vercel-scripts.com) | Ignored when strict-dynamic is honored; kept for older browsers. |
| media-src https: | Hero/CMS video URLs may be arbitrary HTTPS. |
| img-src CDN allowlist | Inventory + avatars + maps of remotePatterns in next.config. |

Production script-src still has **no** `unsafe-inline` and **no** `unsafe-eval` (dev-only unsafe-eval).

## Hydration / preload notes

- Removed duplicate hero poster `<link rel="preload">` that duplicated Next/Image `priority` preload (`corporate-sections.tsx`).
- Platform dashboard welcome greeting/date now mounts client-side to avoid locale/timezone hydration mismatch (`welcome-header.tsx`).
- Root layout already uses `suppressHydrationWarning` on `<html>` for extension-injected attributes.

## Lighthouse


## Lighthouse (post-deploy, 2026-08-04)

CLI run against https://www.truegoshengh.com (mobile simulation):

| Category | Score | Notes |
|----------|-------|-------|
| Accessibility | **96** | Target >95 met. Remaining: muted text contrast was 4.39:1; `--muted-foreground` darkened to `#655484` for WCAG AA. |
| Performance | **57** | Below 90. Primary drag: Total Blocking Time (~1.2s) and CLS (~0.28) on mobile. LCP itself ~2.0s (good). Hero video + JS weight; no large redesign in this pass. Preload dedupe applied. |

Manual re-check: `npm run lighthouse:home`

Run after deploy:

```bash
npm run lighthouse:home
```

Targets: accessibility > 95, performance > 90 where measurable. Prior local artifact `lighthouse-home.html` was against an older Vercel URL — re-run against www for current scores. Sensible fixes applied: preload dedupe; no large redesign.

## Smoke checklist

- [ ] Homepage images + hero video
- [ ] Google Sign-In (redirect via auth.truegoshengh.com -> /auth/callback)
- [ ] Password reset /email recovery path
- [ ] Email verification path
- [ ] No CSP console violations for Next bundles / Serwist
- [ ] Observatory rescan: https://developer.mozilla.org/en-US/observatory/analyze?host=www.truegoshengh.com

## Verify commands

```bash
curl -sI https://www.truegoshengh.com | findstr /I "content-security strict-transport cross-origin permissions x-frame x-content referrer"
curl -sI https://auth.truegoshengh.com | findstr /I "strict-transport"
curl -sI https://truegoshengh.com | findstr /I "location strict-transport"
npm run test:security
npm run typecheck
```
