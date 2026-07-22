# Production Readiness — Performance Audit

**Date:** 2026-07-09  
**Production:** https://truegoshen.vercel.app  
**Deployment:** `dpl_6xMoxMSD9AfLv8Xc8WS6kZrDEMGt` (2026-07-09)

---

## Phase 1 — Bottleneck audit

### Initial load (`/`)

| Area | Status | Notes |
|------|--------|-------|
| PWA precache | ✅ Fixed (prior) | 158 entries → 6; `DeferredPwaShell` after idle |
| LCP hero poster | ✅ Fixed (prior) | `getImageProps` preload matches `/_next/image` |
| Root contexts | ⚠️ Partial | Currency + auth + cart still hydrate on `/`; deferred where possible |
| Chunk reload handler | ✅ Deferred | `DeferredChunkReloadHandler` |

### Platform shell (`/platform/*`)

| Area | Before | After |
|------|--------|-------|
| Session waterfall | Client `/api/admin/session` on every mount | Server-resolved permissions + realtime session passed to shell |
| Notification polling | Immediate on mount | Deferred until `requestIdleCallback` (~1.5s) |
| Sidebar badge polling | Immediate (team/email/trash) | Deferred until idle (~2s) |
| Link prefetch | Viewport-only | `router.prefetch` on sidebar hover/focus |
| Route loading UI | None | `platform/loading.tsx` skeleton |
| Topbar search/notifications | Eager (prior fix) | `dynamic(ssr: false)` with placeholders |

### Dashboard (`/platform/dashboard`)

| Area | Before | After |
|------|--------|-------|
| Table data | Full `/api/admin/vehicles` + `/api/admin/inquiries` | Cached `/api/admin/dashboard/recent` (6 rows each) |
| Chart vehicles | Full fleet `select("*")` | Cached minimal fields via `/api/admin/dashboard/chart-vehicles` |
| KPI extras | Full shipments/quotes/appointments lists | Cached counts via `/api/admin/dashboard/extras` |
| Notifications | Duplicate fetch on dashboard | Reuses `AdminNotificationsProvider` context |
| Below-fold content | Eager render | `DeferredSection` + lazy chart fetch on visible |
| Confirm dialog | Eager import | `dynamic(ssr: false)` |

### Hydration / JS

| Metric | Count |
|--------|-------|
| `"use client"` files | ~175 (interactive admin + public shell — unchanged by design) |
| `framer-motion` | Absent |
| Recharts | Lazy-loaded per chart component |

### Data layer

| Pattern | Implementation |
|---------|----------------|
| Stats | `unstable_cache` 120s + `Cache-Control: private, max-age=30` |
| Dashboard recent | `unstable_cache` 60s |
| Chart vehicles | `unstable_cache` 120s, 8 fields only |
| Dashboard extras | `unstable_cache` 60s, count queries only |

### Images / fonts

| Item | Status |
|------|--------|
| `next/font` Inter | `display: swap`, single family |
| Platform images | `next/image` via `SafeVehicleImage` |
| Hero poster WebP | Deferred — 256 KB JPEG remains; optional follow-up |

### PWA

| Item | Status |
|------|--------|
| Duplicate SW registration | None — single deferred registrar |
| Precache | Whitelist only (offline shell) |
| `navigationPreload` | Disabled |

### Accessibility

Maintained at **100** on public `/` (prior audit). Platform: skip link, landmarks, icon labels.

---

## Top 5 perceived-speed wins (this pass)

1. **Dashboard data diet** — Replaced full fleet + 600+ inquiry rows with cached 12-row recent API (~80–95% less initial payload).
2. **Deferred notification + sidebar polling** — Shell paints before background fetches compete for bandwidth.
3. **Eliminated session waterfall** — Server auth passed to notifications realtime; no extra `/api/admin/session` on mount.
4. **Instant navigation feel** — `platform/loading.tsx` + sidebar `router.prefetch` on hover.
5. **Below-fold deferral** — Charts, tables, and chart-vehicle fetch only when sections approach viewport.

---

## Validation

```powershell
npm run build
npm run lighthouse:platform
```

### Bundle notes (post-build)

Inspect `.next/analyze` or build output for:
- Dashboard page client chunk (should exclude recharts until dynamic import)
- Platform shell chunk (search/notifications split)

### Navigation timing (manual)

1. Open `/platform/dashboard` — shell + KPI skeletons should appear before charts.
2. Hover sidebar links — subsequent navigation should feel instant.
3. Scroll dashboard — insights section triggers chart fetch only when visible.

---

## Files changed (this pass)

### New
- `src/hooks/use-after-idle.ts`
- `src/app/platform/loading.tsx`
- `src/app/api/admin/dashboard/chart-vehicles/route.ts`
- `docs/PRODUCTION_READINESS_PERFORMANCE.md`

### Modified
- `src/app/platform/dashboard/page.tsx`
- `src/app/platform/layout.tsx`
- `src/components/platform/platform-shell.tsx`
- `src/components/platform/sidebar.tsx`
- `src/context/admin-notifications-context.tsx`
- `src/lib/platform/dashboard-server.ts`
- `src/lib/platform/types.ts`
- `src/app/api/admin/dashboard/recent/route.ts`
- `src/components/shared/deferred-section.tsx` (onVisible callback — prior)

### Prior work (not duplicated)
See `docs/PERFORMANCE_RECOVERY_AUDIT.md` and `docs/ADMIN_DASHBOARD_PERFORMANCE_AUDIT.md`.

---

## Remaining follow-ups

1. Hero poster → WebP/AVIF for stable LCP <2.5s on `/`
2. Server-side inventory pagination (inventory page full fleet fetch)
3. Leads table variable-height virtualization
4. Lighthouse CI gate for `/platform/dashboard`
