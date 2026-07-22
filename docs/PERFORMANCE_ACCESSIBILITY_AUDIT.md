# Performance & Accessibility Audit — True Goshen Auto

**Date:** 2026-07-09  
**Production:** https://truegoshen.vercel.app  
**Stack:** Next.js 16.2.9, React 19, Tailwind 4, Supabase  

## Baseline Lighthouse Targets

| Category       | Before | Target   |
|----------------|--------|----------|
| Performance    | 59     | 90+      |
| Accessibility  | 89     | 98–100   |
| Best Practices | 96     | 100      |
| SEO            | 100    | maintain |

---

## Audit Checklist

### Bundle & JavaScript

| Item | Status | Notes |
|------|--------|-------|
| Large JS bundles on public routes | ⚠️ Found | Root layout wraps all pages in 4 client context providers + `SiteChrome` (client). ~170 `"use client"` files. |
| Unused dependency: `framer-motion` | ✅ Removed | Was listed in `package.json` with zero imports; removed (~30–50 KB gzip from install graph). |
| `recharts` | ✅ Isolated | Only used in `dashboard-charts.tsx` (platform). Already dynamically imported on dashboard. |
| `html2pdf.js` | ✅ Isolated | Loaded via dynamic import in print flows only. |
| `country-flag-icons` | ✅ Scoped | Used in `country-flag.tsx` for selector. |
| `lucide-react` | ✅ OK | Per-icon imports (tree-shakeable). |
| Hero background video | ✅ Optimized | Auto home keeps eager hero with poster-first LCP. Corporate home defers video via `dynamic(ssr: false)` + priority poster. |
| Vehicle cards all client | ✅ Split | `VehicleCard` is now a server component; interactive actions in `vehicle-card-client.tsx` islands. |

### Server vs Client Components

| Item | Status | Notes |
|------|--------|-------|
| Unnecessary `"use client"` on pages | ✅ Mostly OK | Public marketing pages (`page.tsx`, `auto/page.tsx`, `auto/inventory/page.tsx`) are server components. |
| `SiteChrome` client boundary | ⚠️ Found | Required for `usePathname` routing chrome, but pulls header/footer client JS on every page. |
| `SafeVehicleImage` client | ✅ Split | Server shell resolves URL; tiny `safe-vehicle-image-client.tsx` island handles `onError` fallback only. |
| Context providers in root layout | ⚠️ Found | Currency, auth, notifications, parts cart — all client, unavoidable for features. |

### Images

| Item | Status | Notes |
|------|--------|-------|
| `next/image` usage | ✅ Good | `SafeVehicleImage` wraps `next/image` with sizes, lazy loading, priority flags. |
| Remote patterns | ✅ Configured | Cloudinary, Supabase, Unsplash, etc. in `next.config.ts`. |
| Empty `alt` on meaningful images | ⚠️ Found | `order-card.tsx`, `vehicle-categories` background (decorative). Vehicle cards use `formatVehicleName(vehicle)`. |
| Hero poster `alt=""` | ✅ OK | Decorative with `aria-hidden`. |

### Render-blocking & Hydration

| Item | Status | Notes |
|------|--------|-------|
| Inline cache-recovery script | ⚠️ Minor | Small inline script in `<head>` for chunk recovery. |
| `Inter` via `next/font` | ✅ Good | `display: swap`, CSS variable. |
| `DeferredSection` | ✅ Good | Intersection Observer defers below-fold sections on home pages. |
| `Suspense` on `PublicShell` | ✅ Good | Streams CMS content; static fallback during prerender. |
| Multiple `useEffect` in contexts | ⚠️ Found | Currency/auth hydrate from localStorage on mount. |

### Data / Supabase

| Item | Status | Notes |
|------|--------|-------|
| Public listing select | ✅ Good | `PUBLIC_LISTING_SELECT` limits fields in `vehicle-queries.ts`. |
| Inventory page query | ✅ Good | Single paginated query + parallel `getSiteContent()`. |
| N+1 on vehicle detail | ✅ OK | Single `fetchVehicleBySlug`; related vehicles in separate client fetch. |
| ISR / revalidate | ✅ Good | 60–120s on public routes. |

### Animations

| Item | Status | Notes |
|------|--------|-------|
| Framer Motion | ✅ Removed | Dependency removed from `package.json`; never imported in `src/`. |
| CSS hero animations | ⚠️ Minor | `hero-fade-in` delays up to 0.55s; `prefers-reduced-motion` respected. |
| WhatsApp / availability pulse | ⚠️ Minor | Infinite CSS animations; now disabled under `prefers-reduced-motion`. |

### Accessibility

| Item | Status | Notes |
|------|--------|-------|
| Skip to main content | ❌ Missing → ✅ Fixed | Added `SkipToContent` + `#main-content` landmark. |
| `aria-hidden` on focusable mobile nav | ❌ Found → ✅ Fixed | Replaced with `inert` on closed drawer/backdrop. |
| Icon-only button labels | ✅ Mostly OK | Header menu, cart, saved vehicles have `aria-label` / `sr-only`. |
| Touch targets < 44px | ⚠️ Found → ✅ Fixed | Mobile menu buttons `size-9` (36px) → `min-h-11 min-w-11` (44px). Save button on cards enlarged. |
| Focus indicators | ⚠️ Partial → ✅ Fixed | Global `:focus-visible` ring added. |
| Semantic landmarks | ✅ Good | `<header>`, `<main>`, `<nav aria-label>`, `<footer>`. |
| Heading hierarchy | ✅ OK | Single `h1` per page; sections use `h2`/`h3`. |
| Dialog close button | ⚠️ Minor → ✅ Fixed | `XIcon` marked `aria-hidden` (label via `sr-only`). |
| Form labels | ✅ OK | shadcn `Label` + `htmlFor` on forms. |
| SEO metadata | ✅ Good | `metadataBase`, OG, per-route titles unchanged. |

### Admin / Platform

| Item | Status | Notes |
|------|--------|-------|
| Platform route code-split | ✅ OK | Separate `platform/layout.tsx` with auth gate; not in public bundle. |
| Platform shell client | ⚠️ Expected | Full admin UI appropriately client-side. |
| Platform sidebar `inert` | ✅ Fixed | Closed mobile drawer/backdrop use `inert` instead of `aria-hidden` focus trap. |

---

## Implemented Optimizations

### Phase 1 — Accessibility (low risk, high score impact)

| Change | Files | Why | Expected | Trade-offs |
|--------|-------|-----|----------|------------|
| Skip-to-main link | `skip-to-content.tsx`, `layout.tsx`, `site-chrome.tsx` | WCAG 2.4.1 bypass blocks | +3–5 a11y points | None |
| `inert` on closed mobile nav | `header.tsx`, `corporate-header.tsx` | Fixes focus escaping into hidden drawer | +2–4 a11y points | Requires React 19 / modern browsers |
| 44px touch targets | `header.tsx`, `corporate-header.tsx`, `vehicle-card.tsx` | WCAG 2.5.5 target size | +1–2 a11y points | Slightly larger tap areas |
| Global `:focus-visible` styles | `globals.css` | Keyboard navigation visibility | +1–3 a11y points | Mouse users unaffected |
| Image `alt` improvements | `order-card.tsx`, `vehicle-categories.tsx` | Meaningful alt text | +1–2 a11y points | None |
| Dialog icon `aria-hidden` | `dialog.tsx` | Redundant announcement fix | Minor | None |
| `prefers-reduced-motion` expansion | `globals.css` | Disables pulse animations | UX + a11y | None |

### Phase 2 — Performance (code splitting)

| Change | Files | Why | Expected | Trade-offs |
|--------|-------|-----|----------|------------|
| `dynamic()` VehicleSearch | `auto/page.tsx` | Defers filter form + Select UI chunk | −15–30 KB initial JS on auto home | Brief placeholder height |
| `dynamic()` RecommendedVehicles | `auto/page.tsx`, `auto/inventory/page.tsx` | Client fetch section split | −10–20 KB initial JS | None visible |
| `dynamic()` StartYourJourney | `page.tsx` | Heavy client section (images, journey cards) | −20–40 KB on corporate home | Placeholder during load |
| `dynamic()` inventory filters/sort/pagination | `auto/inventory/page.tsx` | Splits filter UI from page shell | −25–40 KB on inventory | Filters appear after chunk loads |
| `dynamic()` vehicle detail sidebar/video/related | `vehicle-detail-page.tsx` | Splits heavy client islands | Faster TTI on VDP | Sidebar skeleton briefly |

### Phase 3 — Deferred follow-ups (performance 90+ push)

| Change | Files | Why | Expected | Trade-offs |
|--------|-------|-----|----------|------------|
| Remove unused `framer-motion` | `package.json`, `package-lock.json` | Dead dependency in install graph | −30–50 KB gzip (install); cleaner lockfile | None |
| `VehicleCard` server/client split | `vehicle-card.tsx`, `vehicle-card-client.tsx` | Card markup SSR'd; garage/cart/compare hydrate as small islands | −40–80 KB initial JS on inventory grids (9+ cards) | Slight hydration for action buttons |
| `SafeVehicleImage` server/client split | `safe-vehicle-image.tsx`, `safe-vehicle-image-client.tsx` | URL normalization on server; error fallback stays client | Smaller client boundary per image | Minimal per-image client island |
| Corporate hero video deferred | `corporate-sections.tsx`, `deferred-hero-background-video.tsx` | Poster is LCP on `/`; video chunk loads client-only | +3–8 perf on corporate home | Video fades in after idle (poster visible first) |
| Platform sidebar `inert` | `platform/sidebar.tsx` | Same a11y fix as public mobile nav | +1–2 a11y on platform routes | None |
| Lighthouse local script | `package.json` (`lighthouse:home`) | Regression tracking without CI setup | Manual audits before releases | Requires Chrome locally |

---

## Expected Score Improvements (estimated)

| Category | Estimate | Rationale |
|----------|----------|-----------|
| Performance | 78–88 → **88–94** | Phase 3 removes dead deps, server-renders vehicle grids, defers corporate hero video JS. Auto home hero unchanged (poster-first LCP preserved). |
| Accessibility | 96–100 → **97–100** | Platform sidebar `inert` closes remaining focus-trap gap. |
| Best Practices | 98–100 | Unchanged. |
| SEO | **100** | Metadata unchanged. |

> **Note:** Hitting Performance **95+** consistently may still need hero video bitrate optimization or self-hosting critical fonts. Run `npm run lighthouse:home` after deploy to verify.

---

## Deferred Follow-ups

1. ~~**Remove `framer-motion`**~~ ✅ Done (Phase 3).
2. ~~**Split `VehicleCard`**~~ ✅ Done (Phase 3).
3. ~~**Convert `SafeVehicleImage`**~~ ✅ Done (Phase 3).
4. ~~**Lazy-load corporate `HeroBackgroundVideo`**~~ ✅ Done (Phase 3).
5. **Pre-existing TypeScript build errors** in `api/admin/vehicles/route.ts`, `api/customer/delete-account/route.ts`, `platform/account-lifecycle/page.tsx` — unrelated to perf/a11y; `next build` passes on Vercel.
6. ~~**Lighthouse CI**~~ ✅ Local script added (`npm run lighthouse:home`); GitHub Actions not configured (no `.github/`).
7. ~~**Platform sidebar `aria-hidden` → `inert`**~~ ✅ Done (Phase 3).
8. **Auto home hero video** — further LCP gains via lower-bitrate mobile clip or CDN poster preload link.

## Files Changed

### Phase 1 — Accessibility
- `src/components/layout/skip-to-content.tsx` (new)
- `src/app/layout.tsx`
- `src/components/layout/site-chrome.tsx`
- `src/components/layout/header.tsx`
- `src/components/layout/corporate-header.tsx`
- `src/app/globals.css`
- `src/components/account/order-card.tsx`
- `src/components/home/vehicle-categories.tsx`
- `src/components/shared/vehicle-card.tsx`
- `src/components/ui/dialog.tsx`

### Phase 2 — Performance
- `src/app/page.tsx`
- `src/app/auto/page.tsx`
- `src/app/auto/inventory/page.tsx`
- `src/components/vehicle/vehicle-detail-page.tsx`

### Phase 3 — Deferred follow-ups
- `package.json` (removed `framer-motion`, added `lighthouse:home`)
- `package-lock.json`
- `src/components/shared/vehicle-card.tsx`
- `src/components/shared/vehicle-card-client.tsx` (new)
- `src/components/shared/safe-vehicle-image.tsx`
- `src/components/shared/safe-vehicle-image-client.tsx` (new)
- `src/components/shared/deferred-hero-background-video.tsx` (new)
- `src/components/corporate/corporate-sections.tsx`
- `src/components/platform/sidebar.tsx`

---

## Build & Deploy

**Build status:** ✅ Passed (`npm run build` — 2026-07-09, Phase 3)

```
✓ Compiled successfully in 20.6s
✓ Finished TypeScript in 32.3s
✓ Generating static pages (144/144)
```

**Deploy:** ✅ Production — https://truegoshen.vercel.app  
**Deployment ID:** `dpl_YqWvy4obbnEgqtVMKMQWKkvxntJH`

### Lighthouse regression check

```bash
npm run lighthouse:home
```

Writes `lighthouse-home.html` in the project root (requires Chrome). No GitHub Actions workflow — run locally before releases.

### Bundle impact (estimated)

| Change | Impact |
|--------|--------|
| `framer-motion` removed | −3 packages from lockfile; ~30–50 KB gzip if ever bundled |
| `VehicleCard` server split | Inventory/home grids ship static HTML; compare/garage/cart JS hydrates per card as small islands instead of one full client card × N |
| Corporate hero `ssr: false` | `hero-background-video` chunk excluded from corporate home SSR bundle |
| `SafeVehicleImage` split | URL normalization runs on server; client island is ~1 KB per image |
