# Admin Dashboard Performance Audit — True Goshen Auto

**Date:** 2026-07-09  
**Production:** https://truegoshen.vercel.app/platform/dashboard  
**Stack:** Next.js 16.2.9, React 19, Tailwind 4, Supabase, Recharts  

## Lighthouse Targets

| Category       | Before (est.) | Target   | After (est.) |
|----------------|---------------|----------|--------------|
| Performance    | ~65           | 90+      | **90–94**    |
| Accessibility  | ~92           | 100      | **98–100**   |
| Best Practices | ~96           | 100      | **98–100**   |

> Run `npm run lighthouse:platform` after deploy for local verification (requires Chrome).

---

## Before Audit Checklist

### Architecture & Client Boundaries

| Item | Before | Notes |
|------|--------|-------|
| `/platform/*` pages with `"use client"` | **33 / 33** | All route pages are client components — required for interactive admin CRUD, filters, and auth redirects. |
| Platform components with `"use client"` | **35** | Shell, sidebar, topbar, forms, charts, dialogs appropriately client-side. |
| `page-header.tsx` client boundary | ⚠️ Unnecessary | Entire header was client for `BackButton` only. |
| `platform-shell.tsx` session fetch | ⚠️ Duplicate | Layout already resolves auth server-side; shell re-fetched `/api/admin/session` on mount. |
| `GlobalSearch` + `NotificationCenter` in topbar | ⚠️ Eager | Loaded on every platform route in initial topbar bundle. |
| `recharts` on dashboard | ✅ Partial | Charts already `dynamic(ssr: false)`; still pulled with dashboard page. |
| `framer-motion` | ✅ Absent | Not in dependencies; zero imports. |

### Dashboard Data Loading

| Item | Before | Notes |
|------|--------|-------|
| Stats API | ✅ Cached | `unstable_cache` 120s in `stats-server.ts` + `Cache-Control: private, max-age=30`. |
| Dashboard vehicles fetch | ❌ Heavy | `GET /api/admin/vehicles` — full fleet `select("*")` for 6-row table. |
| Dashboard inquiries fetch | ❌ Heavy | `GET /api/admin/inquiries` — 6 tables × 100 rows + profiles for 6-row table. |
| Dashboard transactions dismissals | ⚠️ Separate | Third round-trip after stats. |
| Below-fold charts/tables | ❌ Eager | Rendered on first paint even when off-screen. |
| Stat cards loading UX | ⚠️ Blocking | Full-page spinner until stats returned. |

### Large Tables

| Item | Before | Notes |
|------|--------|-------|
| Inventory table | ❌ All DOM rows | Full fleet rendered in `<tbody>`; scroll container only. |
| Leads table | ❌ All DOM rows | Up to 600+ unified leads in DOM. |
| Customers table | ❌ All DOM rows | Expandable rows; no scroll cap. |
| `@tanstack/react-virtual` | N/A | Not in dependencies — lightweight in-house virtualizer added. |

### React / Context

| Item | Before | Notes |
|------|--------|-------|
| Platform session context | ⚠️ Hydration delay | Permissions defaulted then overwritten after client fetch. |
| Currency + notifications providers | ✅ Required | Scoped to `PlatformShell`; unavoidable for admin features. |
| `lucide-react` imports | ✅ OK | Per-icon imports (tree-shakeable). |

### Assets & Fonts

| Item | Before | Notes |
|------|--------|-------|
| `Inter` via root `next/font` | ✅ Good | `display: swap`, CSS variable reused in `platform.css`. |
| Platform images | ✅ OK | `SafeVehicleImage` / `next/image` with sizes in inventory grids. |

### Accessibility (Platform)

| Item | Before | Notes |
|------|--------|-------|
| Skip to main content | ❌ Missing | Public site had skip link; platform did not. |
| `#main-content` landmark | ❌ Missing | Main had no id for skip target. |
| Sidebar `inert` on closed drawer | ✅ Fixed (prior) | Mobile drawer uses `inert`. |
| Icon-only delete buttons | ⚠️ Partial | Dashboard trash buttons lacked `aria-label`. |
| Account menu button | ⚠️ Partial | No accessible name on user menu trigger. |
| Unread notification dot | ⚠️ Partial | No text for screen readers. |

---

## Implemented Optimizations

### Phase 1 — Dashboard data & caching

| Change | Files | Impact |
|--------|-------|--------|
| New `getDashboardRecent()` with `unstable_cache` (60s) | `dashboard-server.ts`, `api/admin/dashboard/recent/route.ts` | Replaces full vehicles + inquiries fetches with targeted queries (6 transactions, 6 leads, limited fields). **~80–95% less dashboard table payload.** |
| Parallel dashboard load | `dashboard/page.tsx` | Stats + notifications + recent in `Promise.all`; tables no longer block stat cards. |
| Stat / table skeletons | `dashboard/page.tsx` | Non-blocking UI; stats render while below-fold loads. |

### Phase 2 — Code splitting & deferred render

| Change | Files | Impact |
|--------|-------|--------|
| `DeferredSection` for charts + tables | `dashboard/page.tsx` | Recharts chunks load only when section nears viewport. |
| `dynamic()` ConfirmDialog, PreorderNotificationPreview | `dashboard/page.tsx` | Dialog + preview JS deferred until needed. |
| `dynamic()` GlobalSearch, NotificationCenter | `topbar.tsx` | **~25–40 KB** removed from initial platform shell JS on non-search routes. |
| `memo` on dashboard table rows | `dashboard/page.tsx` | Fewer re-renders on toast/state updates. |

### Phase 3 — Shell & session

| Change | Files | Impact |
|--------|-------|--------|
| Server-resolved permissions passed to shell | `layout.tsx`, `platform-shell.tsx`, `permissions.ts` | Eliminates `/api/admin/session` waterfall on every navigation. |
| `buildSessionPermissions()` helper | `permissions.ts`, `session/route.ts` | DRY; fixes missing `account_lifecycle` in session API. |
| `PageHeader` → server component | `page-header.tsx` | Smaller client boundary; `BackButton` remains client island. |

### Phase 4 — Table performance

| Change | Files | Impact |
|--------|-------|--------|
| `VirtualTableBody` + `VirtualTableScroll` | `virtual-table-body.tsx`, `inventory/page.tsx` | Windowed rendering for 40+ inventory rows; **O(visible)** DOM nodes. |
| Scroll-capped leads/customers tables | `leads/page.tsx`, `customers/page.tsx` | `max-h-[min(70vh,48rem)]` limits paint/layout area. |

### Phase 5 — Accessibility

| Change | Files | Impact |
|--------|-------|--------|
| `SkipToContent` + `#main-content` | `layout.tsx`, `platform-shell.tsx` | WCAG 2.4.1 bypass block on admin. |
| `aria-label` on delete / account controls | `dashboard/page.tsx`, `topbar.tsx` | Icon-only controls named for AT. |
| `aria-hidden` on decorative icons | `dashboard/page.tsx` | Reduces redundant announcements. |
| Unread dot `aria-label` | `dashboard/page.tsx` | Screen reader context for notifications. |

---

## Bundle & Render Improvements (estimated)

| Area | Before | After |
|------|--------|-------|
| Dashboard initial API payload | Full fleet + 600+ inquiry rows | Stats + 5 notifications + 12 recent rows |
| Dashboard JS (charts) | Loaded on first paint | Loaded at scroll (~240px margin) |
| Topbar JS | Search + notifications eager | Lazy chunks with placeholders |
| Session hydration | +1 fetch, permission flash | Server-provided permissions |
| Inventory 200+ rows | 200+ `<tr>` nodes | ~20 visible `<tr>` nodes (virtualized) |
| Platform `"use client"` pages | 33 | 33 (unchanged — interactive admin) |
| Platform client components | 35 | 36 (+virtual-table-body); `page-header` now server |

---

## Expected Lighthouse Scores (post-deploy)

| Category | Estimate | Rationale |
|----------|----------|-----------|
| **Performance** | **90–94** | Smaller initial JS (lazy topbar widgets, deferred charts), eliminated heavy dashboard fetches, virtualized inventory, non-blocking skeletons. |
| **Accessibility** | **98–100** | Skip link, landmark, icon labels, prior sidebar `inert`. |
| **Best Practices** | **98–100** | No regressions; private cache headers on admin APIs. |

---

## Verification

```bash
npm run build
npm run lighthouse:platform
```

**Build status:** ✅ Passed (`npm run build` — 2026-07-09)

**Deploy:** ✅ Production — https://truegoshen.vercel.app  
**Deployment ID:** `dpl_CQtA7fTY4Ut8iDQYJZ6JnqBv6hJj`

---

## Files Changed

### New
- `src/lib/platform/dashboard-server.ts`
- `src/app/api/admin/dashboard/recent/route.ts`
- `src/components/platform/virtual-table-body.tsx`
- `docs/ADMIN_DASHBOARD_PERFORMANCE_AUDIT.md`

### Modified
- `src/app/platform/dashboard/page.tsx`
- `src/app/platform/layout.tsx`
- `src/app/platform/inventory/page.tsx`
- `src/app/platform/leads/page.tsx`
- `src/app/platform/customers/page.tsx`
- `src/components/platform/platform-shell.tsx`
- `src/components/platform/page-header.tsx`
- `src/components/platform/topbar.tsx`
- `src/lib/platform/permissions.ts`
- `src/app/api/admin/session/route.ts`
- `package.json` (`lighthouse:platform` script)

---

## Deferred Follow-ups

1. **Server-side inventory pagination** — Would reduce `/api/admin/vehicles` payload on inventory page; requires API + filter contract changes (larger than perf-only scope).
2. **Leads virtualizer** — Expandable note rows need variable-height virtualization or accordion pattern.
3. **Lighthouse CI** — Add GitHub Action for `/platform/dashboard` regression gate.
4. **Combine stats + recent API** — Optional single round-trip; current 3 parallel calls are acceptable with caching.
