# Enterprise Performance Recovery — True Goshen Auto

**Date:** 2026-07-09  
**Production:** https://truegoshen.vercel.app  
**Scope:** Full optimization pass — homepage + admin platform (dashboard priority)

## Targets

| Category | Before (est.) | Target | After (est.) |
|----------|---------------|--------|--------------|
| Homepage Performance | 58 → 89 | 90+ | **89–92** |
| Platform Dashboard Performance | ~65 (timeout risk) | 90+ | **90–94** |
| Accessibility | ~89–96 | 100 | **98–100** |
| Best Practices | ~96 | 100 | **96–100** |
| SEO | 100 | 100 | **100** |

---

## Phase 1 — Root Cause Analysis

### 1.1 Bundle size & route chunks

| Issue | Severity | Files |
|-------|----------|-------|
| Recharts chunk ~240 KB loaded with dashboard first paint | **Critical** | `dashboard-charts.tsx`, `business-insights.tsx` |
| Platform shell eager: GlobalSearch + NotificationCenter | **High** | `topbar.tsx` (fixed: `dynamic(ssr:false)`) |
| ConfirmDialog in dashboard initial bundle | **Medium** | `dashboard/page.tsx` (fixed: `dynamic`) |
| Large admin chunks: `08ew5gdls90aw.js` ~940 KB, `119rmzvn7mere.js` ~394 KB | **High** | platform routes aggregate |
| Serwist precache was 158 entries (~8 MB) | **Critical** (prior) | `serwist/[path]/route.ts` → 6 entries |
| ~210 `"use client"` modules codebase-wide | **Medium** | 33/33 platform pages client (required for CRUD) |

### 1.2 Admin dashboard bottlenecks (CRITICAL)

| Bottleneck | Severity | Root cause | Files |
|------------|----------|------------|-------|
| **Lighthouse timeout** | **Critical** | Full-page blocking until stats + full fleet + full inquiries returned | `dashboard/page.tsx` |
| Full fleet fetch for 6-row table | **Critical** | `GET /api/admin/vehicles` `select("*")` entire fleet | `dashboard/page.tsx`, `api/admin/vehicles` |
| Full inquiries fetch (6 tables × 100 rows) | **Critical** | `GET /api/admin/inquiries` for 6 lead rows | `dashboard/page.tsx`, `api/admin/inquiries` |
| Full shipments + quotes for counts | **High** | Client-side `.filter().length` on full arrays | `dashboard/page.tsx` |
| Full appointments list for today count | **High** | `GET /api/admin/appointments` limit 200 | `dashboard/page.tsx` |
| KPI cards blocked on stats | **High** | `if (loading) return <full-page-spinner>` | `dashboard/page.tsx` |
| Charts rendered above fold | **High** | BusinessInsights + Recharts on first paint | `business-insights.tsx` |
| Duplicate session fetch | **Medium** | `/api/admin/session` in notifications provider | `admin-notifications-context.tsx` |
| Chart vehicles = entire fleet | **High** | `vehicles` prop from full fleet fetch | `business-insights.tsx` |

### 1.3 Duplicate API calls & missing cache

| Call pattern | Before | After |
|--------------|--------|-------|
| Dashboard mount | stats → then vehicles + inquiries + transactions + freight + appointments (sequential waves) | stats + recent (parallel wave 1); extras idle-deferred; chart-vehicles on scroll |
| Session | layout auth + `/api/admin/session` | Server auth passed to shell + notifications |
| Stats | `unstable_cache` 120s ✅ | unchanged |
| Recent tables | none | `unstable_cache` 60s `getDashboardRecent()` |
| Extras counts | full list fetches | `unstable_cache` 60s count-only `getDashboardExtras(role)` |
| Chart vehicles | full fleet | `unstable_cache` 120s, 8 fields, limit 400 |

### 1.4 Charts, tables, images, fonts, third-party

| Asset | Issue | Fix |
|-------|-------|-----|
| Recharts | 8 chart types in dashboard | `dynamic(ssr:false)` per chart + `DeferredSection` |
| EnhancedDataTable × 2 | Eager below fold | `DeferredSection` + skeleton |
| Inventory table 200+ rows | Full DOM | `VirtualTableBody` (40+ threshold) |
| Leads/customers 600+ rows | Full DOM | Scroll cap `max-h-[min(70vh,48rem)]` (virtualization deferred — expandable rows) |
| Inter via `next/font` | ✅ `display: swap` | `layout.tsx` |
| lucide-react | Per-icon imports ✅ | tree-shakeable |
| html2pdf.js | Admin-only, not on dashboard | OK |
| recharts | Dashboard only when scrolled | deferred |

### 1.5 Context re-renders

| Provider | Scope | Mitigation |
|----------|-------|------------|
| `AdminNotificationsProvider` | Entire platform shell | Idle-deferred poll (1.5s); server `realtimeSession` |
| `PlatformCurrencyProvider` | Shell | Required for price formatting |
| `PlatformSessionContext` | Shell | Server-resolved permissions (no client fetch) |

---

## Phases 2–13 — Optimization Log

### Phase 2 — Architecture
- Platform layout resolves auth server-side; permissions passed to `PlatformShell` (no hydration flash).
- `PageHeader` is server component; `BackButton` remains client island.
- Dashboard remains `"use client"` (interactive CRUD, currency, dismiss actions).

### Phase 3 — Admin dashboard (CRITICAL)
- **Shell renders immediately:** WelcomeHeader + QuickActions + KPI skeletons without waiting for stats.
- **Progressive load:** `DeferredSection` for insights grid and bottom tables.
- **Non-blocking stats:** `KpiCards loading={statsLoading}` skeleton instead of full-page spinner.
- **Dynamic imports:** `BusinessInsights`, `ConfirmDialog` (`ssr: false`).

### Phase 4 — Data
- **Wave 1 (parallel):** `/api/admin/stats` + `/api/admin/dashboard/recent`.
- **Wave 2 (idle):** `/api/admin/dashboard/extras` via `useAfterIdle(2000)`.
- **Wave 3 (scroll):** `/api/admin/dashboard/chart-vehicles` + activity log on `DeferredSection.onVisible`.
- **Removed:** `/api/admin/vehicles`, `/api/admin/inquiries`, full freight/appointments list fetches from dashboard.

### Phase 5 — JS
- Lazy topbar widgets (prior).
- Dashboard code-split: charts, confirm dialog, insights section.

### Phase 6 — React
- `memo(LeadContactCell)` on dashboard lead table.
- Notifications from context (no duplicate dashboard notifications fetch).
- `insightsLoadedRef` prevents duplicate chart fetch.

### Phase 7–8 — Images & fonts
- No regressions; platform uses `SafeVehicleImage` / `next/image` where applicable.
- Inter `display: swap` on root layout.

### Phase 9 — Charts
- All Recharts via `dynamic(ssr:false)` in `business-insights.tsx`.
- Chart data from lightweight `/api/admin/dashboard/chart-vehicles` (8 fields, max 400 rows).

### Phase 10 — Tables
- Inventory: `VirtualTableBody` + `VirtualTableScroll`.
- Leads/customers: scroll-capped containers (expandable rows block full virtualization).

### Phase 11 — Caching
| Endpoint | Cache |
|----------|-------|
| `/api/admin/stats` | `unstable_cache` 120s + `Cache-Control: private, max-age=30` |
| `/api/admin/dashboard/recent` | `unstable_cache` 60s + HTTP cache |
| `/api/admin/dashboard/extras` | `unstable_cache` 60s (role-keyed) |
| `/api/admin/dashboard/chart-vehicles` | `unstable_cache` 120s |

### Phase 12 — Accessibility
- Skip link + `#main-content` on platform (prior).
- `aria-label` on icon-only controls; `aria-hidden` on decorative icons.
- Skeleton sections use `role="status"` + `aria-label`.

### Phase 13 — Validation

```bash
npm run build          # ✅ Passed 2026-07-09
npm run lighthouse:home
npm run lighthouse:platform
```

#### Estimated score improvement

| Area | Before | After | Δ |
|------|--------|-------|---|
| Dashboard initial API payload | Full fleet + 600+ inquiry rows | Stats + 12 recent rows + count extras | **~90–95% smaller** |
| Dashboard TBT | High (blocking fetches + Recharts) | Shell instant; charts at scroll | **~60–70% lower** |
| Dashboard LCP | Blocked on data | Welcome header + shell paint first | **~2–4s faster** |
| Homepage Performance | 58 | 89 (prior PWA fixes) | +31 |
| Platform Performance | ~65 (timeout) | 90–94 (est.) | +25–29 |

---

## Files changed (this pass)

### New
- `src/lib/platform/dashboard-extras-server.ts`
- `src/app/api/admin/dashboard/extras/route.ts`
- `src/app/api/admin/dashboard/chart-vehicles/route.ts`
- `docs/ENTERPRISE_PERFORMANCE_RECOVERY.md`

### Modified
- `src/app/platform/dashboard/page.tsx` — progressive load, targeted APIs, deferred sections
- `src/lib/platform/dashboard-server.ts` — chart vehicles cache, failed payment count in recent
- `src/components/shared/deferred-section.tsx` — `onVisible` callback for lazy data
- `src/hooks/use-after-idle.ts` — TS fix for fallback timer

### Prior work (built on, not duplicated)
- `docs/PERFORMANCE_RECOVERY_AUDIT.md`, `docs/ADMIN_DASHBOARD_PERFORMANCE_AUDIT.md`
- `DeferredSection`, `VirtualTableBody`, `dashboard/recent` API
- Serwist minimal precache, deferred PWA shell
- `platform-shell.tsx` server permissions, lazy topbar

---

**Deploy:** https://truegoshen.vercel.app  
**Deployment ID:** `dpl_xQ3Cgw3ZZZsDVkuj1MWLiYvTkKJQ` (2026-07-09)

1. Leads/customers variable-height virtualization for expandable rows.
2. Hero poster WebP/AVIF compression for stable homepage LCP <2.5s.
3. Lighthouse CI gate on `/platform/dashboard`.
4. Best Practices 100 — investigate remaining 4-point gap on homepage.
