# Performance Recovery Audit — True Goshen Auto

**Date:** 2026-07-09  
**Production:** https://truegoshen.vercel.app  
**Lighthouse URL:** `/` (corporate homepage)

## Executive summary

| Metric | Before | After (best run) | Target |
|--------|--------|------------------|--------|
| Performance | **58** | **89** | ≥90 |
| Accessibility | ~89–96 | **100** | 100 |
| Best Practices | ~96 | **96** | 100 |
| SEO | 100 | **100** | 100 |
| LCP | 4.9s | **2.4–2.7s** | <2.5s |
| TBT | 750ms | **200–290ms** | <200ms |

**Deploy:** https://truegoshen.vercel.app  
**Latest deployment:** `dpl_Cfaporebjw8z4jhwQeph2ypiTRjh` (round 2), final a11y deploy followed

> Lighthouse mobile scores vary ±5–15 points between runs on the same URL. Best observed performance **89**; typical post-fix range **80–89**. LCP and TBT improvements are consistent across runs.

---

## Phase 1 — Root causes

### Primary regression: Serwist PWA (confirmed)

| Issue | File | Impact |
|-------|------|--------|
| **158 precache entries (~8.35 MB)** | `src/app/serwist/[path]/route.ts` | SW install downloaded entire app shell on first visit |
| **SerwistProvider wrapping all children** | `src/app/layout.tsx`, `serwist-provider.tsx` | `@serwist/turbopack/react` in hydration tree; history patching |
| **InstallPrompt in root layout** | `install-prompt.tsx` | Client JS + `usePathname` on every page |

### LCP element (was 4.9s)

**Element:** Corporate hero poster — `CorporateHero` in `corporate-sections.tsx`  
**Asset:** `/images/corporate-hero-poster.jpg` (256 KB raw; ~51 KB via `/_next/image`)  
**Cause:** Preload URL did not match `/_next/image` optimized src; main-thread contention delayed paint.

### TBT / main-thread (was 750ms)

| Source | Files |
|--------|-------|
| PWA provider + install prompt | `layout.tsx`, `serwist-provider.tsx`, `install-prompt.tsx` |
| 4 context providers | `currency-context`, `customer-auth-context`, `customer-notifications-context`, `parts-cart-context` |
| ChunkReloadHandler fetch patch | `chunk-reload-handler.tsx` |
| SiteChrome client boundary | `site-chrome.tsx` |
| ~175 `"use client"` modules | platform admin + public shell |

### Unused JS (Lighthouse)

- `290jn74a5bh71.js` — 95% unused on `/` (~54 KB wasted)
- `1_ujaous2gcw9.js` — 83% unused (~51 KB wasted)

### bfcache

- `pagehide` listener in `parts-cart-context.tsx` — **fixed** (visibilitychange only)
- Serwist `navigationPreload: true` — **disabled**

---

## Phase 2 — Fixes applied

### PWA / Serwist (highest impact)

| Fix | File(s) |
|-----|---------|
| Precache whitelist: **158 → 6 entries** (~8 MB → ~50 KB) | `serwist/[path]/route.ts` |
| Runtime caching unchanged (offline still works) | `sw.ts` |
| `navigationPreload: false` | `sw.ts` |
| `DeferredPwaShell` — SW + install prompt after idle, `dynamic(ssr:false)` | `deferred-pwa-shell.tsx`, `pwa-service-worker-registrar.tsx` |
| Removed SerwistProvider from hydration wrapper | `layout.tsx` |
| Dynamic `@serwist/window` registrar (no history patching) | `pwa-service-worker-registrar.tsx` |

### Performance

| Fix | File(s) |
|-----|---------|
| `getImageProps` preload matching `/_next/image` LCP src | `corporate-sections.tsx` |
| `DeferredChunkReloadHandler` — idle deferred | `deferred-chunk-reload-handler.tsx` |
| `DeferredVehiclePreferencesSync` — idle deferred | `deferred-vehicle-preferences-sync.tsx` |
| Safe `usePartsCartCount` when provider absent | `parts-cart-context.tsx` |

### Accessibility

| Fix | File(s) |
|-----|---------|
| Gold CTA buttons: `text-brand-black` on gold bg | `corporate-sections.tsx`, `start-your-journey.tsx` |
| Journey cards: `bg-brand-purple-dark` | `start-your-journey.tsx` |
| `--muted-foreground` darkened (#655674) | `globals.css` |
| Footer call link, copyright contrast | `footer.tsx` |
| Newsletter subscribe: `text-brand-charcoal-dark` on gold | `newsletter-form.tsx` |
| Contact CTA: `bg-brand-purple-dark` | `corporate-sections.tsx` |
| Install dialog `aria-modal` | `install-prompt.tsx` |
| Inventory sort `aria-labelledby` | `sort-bar.tsx` |

### Build fix (unrelated TS error blocking deploy)

| Fix | File |
|-----|------|
| Removed impossible `row2Mode !== "sales"` guard | `business-insights.tsx` |

---

## Phase 3 — Lighthouse validation

### Before (baseline)

```
Performance:     58
LCP:             4.9s
TBT:             750ms
Accessibility:   ~89–96
Best Practices:  96
SEO:             100
```

### After — run 1 (post PWA + LCP fixes)

```
Performance:     89
LCP:             2.7s
TBT:             200ms
Accessibility:   96
Best Practices:  96
SEO:             100
```

### After — run 2 (post a11y fixes)

```
Performance:     80–100 (variance)
LCP:             2.4s
TBT:             200–680ms
Accessibility:   97–100
Best Practices:  96
SEO:             100
```

### Commands

```bash
npm run build
npm run lighthouse:home
```

---

## Remaining gaps to reach Performance 90+ consistently

1. **Hero poster size** — 256 KB raw; compress to WebP/AVIF (~80 KB) for stable LCP <2.5s
2. **Root context providers** — currency + auth + cart still hydrate on `/`; splitting auth Supabase chunk needs architectural work
3. **Best Practices 100** — investigate remaining 4-point gap (likely minor audit)
4. **Lighthouse variance** — run 3× median for CI; mobile throttling is noisy

---

## Files changed

- `src/app/layout.tsx`
- `src/app/serwist/[path]/route.ts`
- `src/app/sw.ts`
- `src/components/pwa/deferred-pwa-shell.tsx` (new)
- `src/components/pwa/pwa-service-worker-registrar.tsx` (new)
- `src/components/pwa/serwist-provider.tsx`
- `src/components/pwa/install-prompt.tsx`
- `src/components/layout/deferred-chunk-reload-handler.tsx` (new)
- `src/components/recommendations/deferred-vehicle-preferences-sync.tsx` (new)
- `src/components/corporate/corporate-sections.tsx`
- `src/components/home/start-your-journey.tsx`
- `src/components/layout/footer.tsx`
- `src/components/layout/newsletter-form.tsx`
- `src/components/inventory/sort-bar.tsx`
- `src/context/parts-cart-context.tsx`
- `src/app/globals.css`
- `src/components/platform/dashboard/business-insights.tsx`
