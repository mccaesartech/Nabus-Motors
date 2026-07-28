# Admin Platform Performance Audit — True Goshen

**Role:** Principal Performance Engineer  
**Date:** 2026-07-28  
**Repository:** `true-goshen-auto`  
**Production:** https://truegoshen.vercel.app  
**Scope:** Admin interaction latency (dashboard feel, navigations, data fetching, re-renders, API/DB, hot-path bundles). Lighthouse already >90 — not the primary target.  
**Git baseline:** `master` @ `2ce4d49`; working tree clean of tracked modifications (untracked deploy/tsc logs only — preserved).

---

## Executive summary

Prior 2026-07-09 work already fixed the worst dashboard payload problems (full fleet + full inquiries for KPI tables), deferred topbar widgets, virtualized inventory rows, and added `unstable_cache` on stats/recent/charts/extras. **Remaining slowness is interaction-path latency:** heavy list APIs (inventory, leads, sales, customers), sequential inquiry waterfalls, notification/sidebar polling thrash, dashboard chart fetch competing with first paint, and a few unindexed / non-aggregate DB patterns on cache miss.

This audit does **not** recommend redesign or business-logic changes.

---

## 1. Architecture snapshot (current state)

| Layer | Pattern | Notes |
|-------|---------|-------|
| Routing | App Router + `src/proxy.ts` | Auth + permission gate before RSC layout |
| Layout | RSC `platform/layout.tsx` → client `PlatformShell` | Auth + site settings resolved server-side; permissions passed in |
| Pages | Almost all `/platform/*` pages are `"use client"` | Interactive CRUD — expected; soft-nav uses `loading.tsx` skeleton |
| Dashboard data | Client fetches to cached admin APIs | Stats 120s, recent 60s, charts 120s, extras 60s (`unstable_cache`) |
| Shell data | Notifications provider + sidebar badge polls | Idle-deferred; still periodic |
| Tables | Inventory virtualized (≥40 rows); leads/customers scroll-capped | Vehicles/leads APIs still ship large payloads |
| Charts | `dynamic(..., { ssr: false })` via `BusinessInsights` | Recharts not on first shell chunk; still fetched eagerly on dashboard mount |
| React Compiler | Not enabled | Do not add `memo`/`useCallback` by default |

---

## 2. Slow pages

| Page | Severity | Evidence | Why it feels slow |
|------|----------|----------|-------------------|
| `/platform/inventory` | **Critical** | `inventory/page.tsx` → `GET /api/admin/vehicles` returns **entire fleet**, full column set including `gallery` / `additional_images` / `description` | Network + JSON parse + client filter on every visit |
| `/platform/leads` | **Critical** | `leads/page.tsx` → `GET /api/admin/inquiries` without `type` | Up to 6–7 tables × 100 rows (`select *` / join) + all `profiles` with registration_id; client `unifyLeads` + filter |
| `/platform/sales` | **High** | `sales/page.tsx` parallel-fetches `/api/admin/sales` **and** full `/api/admin/vehicles` | Vehicle dropdown does not need gallery blobs |
| `/platform/customers` | **High** | `customers-admin.ts` fans out 5 tables × **limit 500** + in-memory joins | Scales poorly with CRM growth |
| `/platform/dashboard` | **Medium** | Core path improved; `loadInsights` still fires immediately with core | Chart-vehicles (≤400 rows) competes with KPI bandwidth |
| `/platform/finance` | **Low–Medium** | Single expenses API | Usually fine; summary may scan sold/preorder on server |
| Soft navigations (shell) | **Medium** | Full client page remounts; layout auth already done in proxy + layout | Perceived delay until each page’s `useEffect` fetch returns |

---

## 3. Slow components / heavy client islands

| Component | Severity | Issue |
|-----------|----------|-------|
| `PlatformShell` + nested providers | **High** | Currency + notifications wrap entire main + sidebar. Any notification poll or FX rates load re-renders the shell tree. |
| `AdminNotificationsProvider` | **High** | Value memo includes full `notifications[]`; poll/realtime updates re-render consumers (sidebar badges, AttentionCenter, ActivityTimeline). |
| `PlatformSidebar` | **Medium** | Extra polls: team / emails / trash every **45s** after idle; hover prefetch is good. |
| `dashboard-charts.tsx` (Recharts) | **Medium** | Dynamically split (good); still large when insights mount; 400 chart vehicles client-bucketed. |
| `EnhancedDataTable` on dashboard | **Low** | Small pageSize (6); deferred via `DeferredSection`. |
| `VirtualTableBody` | **OK** | Threshold 40; inventory path already uses it. |
| Topbar `GlobalSearch` / `NotificationCenter` | **OK** | Already `dynamic(ssr: false)`. |
| Print / `html2pdf.js` | **OK** | Dynamic import via `document-shell.ts` — off hot path. |

---

## 4. Slow database queries

| Query / helper | Severity | Evidence | Problem |
|----------------|----------|----------|---------|
| `GET /api/admin/vehicles` | **Critical** | `vehicles/route.ts` GET: `adminVehicleSelectColumns("full")`, **no limit** | Transfers gallery JSON for all rows |
| `countLeadPipelineStages` | **High** | `lead-pipeline.ts`: `select("status")` for **all** rows × 5 tables | Full-table status scan for dashboard stats (cached 120s) |
| `countAvailableVehicleUnits` | **High** | `available-units.ts`: select all `stock_quantity` for available vehicles, sum in Node | O(n) transfer on stats cache miss |
| `fetchInventoryChartSegments` | **High** | Stats: all vehicle `id,status` + all preorder `vehicle_id,payment_status,status` | Large scans inside 120s cache |
| Sold revenue in stats | **Medium** | `select("price").eq("status","sold")` all sold rows | Should be `SUM` in DB |
| `fetchAdminNotifications` extras | **Medium** | After main select: `notification_log`, trashed IDs, dismissed keys **sequential** | Extra RTTs on every notifications poll |
| Fallback notifications | **High (conditional)** | `buildFallbackNotifications` scans many tables with `select *` | Only when `admin_notifications` errors — catastrophic path |
| `fetchAdminCustomers` | **High** | 5×500 row fan-out | In-memory aggregation |
| `fetchPreorderInquiries` | **Medium** | `select(*, vehicle:vehicles(...))` limit 100 | Wide rows + join |
| Dashboard recent leads | **Medium** | `select("*")` per inquiry table (limit 12) | Wider than needed for 6-row UI |
| Recent transactions | **Low–Medium** | Preorder confirmed IDs then vehicle `in(...)` | Parallelizable with sold/reserved; already partly parallel |

### Indexes (evidence)

**Present** (`049_performance_indexes.sql`, `074_phase4_query_indexes.sql`):  
vehicles `(status, created_at)`, preorder status/payment, contact/vehicle inquiry status, admin_notifications unread, several `created_at WHERE deleted_at IS NULL`.

**Missing / weak (migration recommended, not applied remotely):**

1. `finance_applications (status, created_at DESC) WHERE deleted_at IS NULL`  
2. `appraisal_requests (status, created_at DESC) WHERE deleted_at IS NULL`  
3. `admin_notifications (recipient_user_id, created_at DESC) WHERE deleted_at IS NULL` (and owner variant) — recipient-scoped list  
4. Optional DB `SUM(stock_quantity)` / RPC for available units (avoid row transfer)

---

## 5. Slow API routes

| Route | Severity | Issue |
|-------|----------|-------|
| `GET /api/admin/vehicles` | **Critical** | Full fleet, full columns, no pagination, no list-tier select |
| `GET /api/admin/inquiries` | **Critical** | **Sequential** `await` per table type when `type=all`; `select *`; unbounded profiles query; nested order items |
| `GET /api/admin/notifications` | **High** | Site settings + available vehicle count + notifications + log + trash + dismissals; polled often |
| `GET /api/admin/customers` | **High** | Multi-table 500-cap fan-out |
| `GET /api/admin/stats` | **Medium** | Many parallel counts (good) but heavy helpers inside; cached 120s + HTTP `max-age=30` |
| `GET /api/admin/dashboard/*` | **Low–Medium** | Already slim + cached; tags never invalidated on writes (staleness up to TTL — acceptable for admin KPIs) |
| `GET /api/admin/sales` (+ vehicles) | **High** | Sales page couples to full vehicles API |

**Cache invalidation gap:** Tags `platform-dashboard-recent|chart-vehicles|extras` exist but **no** `revalidateTag` on admin writes. Stats cache has **no tags**. Prefer TTL-only for this pass (avoid correctness risk); document for later.

---

## 6. React rendering / unnecessary re-renders / Context

| Issue | Severity | Detail |
|-------|----------|--------|
| Notifications context blast radius | **High** | Poll updates `notifications` → new context value → sidebar + dashboard Attention/Timeline re-render |
| Currency `ratesLoaded` flip | **Medium** | One shell-wide re-render after `/api/exchange-rates` |
| Shell `pathname` effect | **Low** | Resets `collapsed`/`mobileOpen` every navigation (extra layout work; intentional UX) |
| Dashboard `session` in effect deps | **Low** | Session object is memoized in shell — OK |
| No React Compiler | Info | Avoid speculative memoization |

---

## 7. Large JS bundles (hot paths)

| Asset / pattern | Severity | Status |
|-----------------|----------|--------|
| `recharts` | **Medium** | Dynamically imported per chart in `business-insights.tsx` — good; still ~large when insights open |
| `lucide-react` | **Low** | Per-icon imports; `optimizePackageImports` **not** set in `next.config.ts` |
| `html2pdf.js` | **OK** | Lazy on print |
| `@google/generative-ai` / Cloudinary | **OK** | Server / non-dashboard paths |
| Platform pages all client | **Accepted** | Required for CRUD; mitigate with API slim + skeletons |

---

## 8. Duplicate / thrashing network

| Pattern | Severity | Detail |
|---------|----------|--------|
| Notification poll + realtime fallback poll | **High** | Provider: **60s** interval. `useNotificationRealtime`: **30s** fallback `onRefresh` when realtime never marks active → **duplicate loads ~every 30s** |
| Sidebar badge polls | **Medium** | Team/email/trash every **45s** (idle-started) — independent of notifications |
| Dashboard insights vs core | **Medium** | Both start as soon as `session` exists (extras correctly idle-deferred) |
| Customers page `/api/admin/session` | **Low** | Extra session fetch only for `canDeleteCustomers` (shell already has permissions) |
| Double auth | **Low–Medium** | `proxy.ts` + `layout.tsx` both resolve platform auth (security over speed; leave alone) |

---

## 9. Hydration / Suspense / streaming

| Item | Status |
|------|--------|
| Platform HTML `Cache-Control: no-store` | Correct for authenticated UI |
| `platform/loading.tsx` | Present — helps soft-nav perception |
| Dashboard | Client-only data; skeletons for KPI/tables — good |
| RSC streaming of page data | Mostly unused (client fetch pattern) — intentional for interactivity |
| Currency localStorage hydrate | Brief currency flash possible — low impact |

---

## 10. Expensive client calculations

| Calc | Severity | Notes |
|------|----------|-------|
| `unifyLeads` on full inquiry payload | **Medium** | Recomputed when inquiries state changes; filtered in `useMemo` |
| Inventory `applyInventoryFilters` over full fleet | **Medium** | Acceptable if payload slimmed |
| Chart bucketing over ≤400 vehicles | **Low** | After insights load |
| Customer in-memory joins | **High** | Server-side in `customers-admin` |

---

## 11. N+1 / OFFSET / pagination

| Area | Finding |
|------|---------|
| N+1 | Orders list embeds `parts_order_items` (OK). Order **detail** can attach vehicle images in a batch (OK). Customer detail may re-call list helpers — watch. |
| OFFSET | Not used heavily; list APIs use `limit` without cursor — fine at current sizes |
| Missing pagination | **Vehicles** and **customers** are the main unbounded/large-bound risks |

---

## 12. Memory / polling / blocking

| Issue | Severity |
|-------|----------|
| Dual notification pollers (30s + 60s) | **High** — thrash + re-render |
| Sidebar 45s × 3 endpoints | **Medium** |
| Realtime channels kept for session lifetime | **OK** if cleaned on unmount (they are) |
| Sync work in request path | Stats/pipeline full scans on cache miss can block serverless invocation |

---

## 13. Missing Suspense / lazy loading opportunities

| Opportunity | Priority |
|-------------|----------|
| Defer dashboard chart-vehicles + activity until idle / near viewport | **High** (loadInsights is eager today) |
| List-tier vehicles select for inventory/sales | **High** |
| Parallelize inquiries GET | **High** |
| Split notifications context (unread vs list) | **Medium** (higher risk) |
| Server-pass `canDeleteCustomers` from layout permissions | **Low** |

---

## 14. Ranked bottlenecks (highest impact first)

| Rank | Bottleneck | Est. improvement (admin feel) | Risk | Fix type |
|------|------------|-------------------------------|------|----------|
| 1 | Full-fleet vehicles API (gallery-heavy) on inventory/sales | **40–70%** less inventory TTFB/payload; snappier table paint | Low–Med | List select / optional `fields=list` |
| 2 | Leads inquiries sequential waterfall + wide `select *` | **30–50%** faster leads first load (parallel + narrower cols later) | Low | Parallelize; slim selects |
| 3 | Duplicate notification polling (30s + 60s) | **~50%** fewer notification API calls; fewer shell re-renders | Low | Single poller |
| 4 | Dashboard `loadInsights` competes with KPI fetch | **100–300ms** faster KPI readiness on cold dashboard | Low | Idle / visibility defer |
| 5 | Customers 5×500 fan-out | **20–40%** faster customers page as data grows | Med | Caps, SQL aggregates later |
| 6 | Stats helpers: pipeline + stock sum + inventory chart scans | **200–800ms** on stats cache miss | Med | Aggregates + indexes |
| 7 | Notifications API sequential post-queries | **50–150ms** per poll | Low | `Promise.all` |
| 8 | Notifications context re-render blast | Smoother sidebar during polls | Med | Context split (later) |
| 9 | Missing finance/appraisal status indexes | Faster open-count / filter plans | Low | Migration SQL only |
| 10 | No `optimizePackageImports` for lucide/recharts | Small cold parse wins | Low | `next.config` |
| 11 | Cache tags never busted | Stale KPIs ≤60–120s (usually OK) | — | Leave TTL-only |
| 12 | Double auth (proxy + layout) | Extra server work per nav | — | Leave (security) |

---

## 15. Intentionally out of scope / leave alone

- Public marketing site redesign / Lighthouse chase  
- Converting all platform pages to RSC (breaks interactive admin patterns)  
- Aggressive `memo` everywhere without React Compiler  
- Remote application of DB migrations  
- Changing lead/inventory business rules or approval flows  
- Removing notification realtime (useful when it works)

---

## 16. Phase 2 plan (this engagement)

Implement **highest-impact, low-risk** items only:

1. Parallelize `GET /api/admin/inquiries` table fetches  
2. Deduplicate notification polling (disable realtime 30s fallback poll when provider owns polling — keep INSERT-driven refresh)  
3. Idle-defer dashboard insights fetch (align with extras)  
4. Parallelize post-fetch work inside `fetchAdminNotifications` where safe  
5. Add list-tier vehicle columns for inventory/sales consumers without changing write paths  
6. `optimizePackageImports` for `lucide-react` / `recharts`  
7. Add migration SQL for finance/appraisal status indexes + document stock `SUM` opportunity  
8. Verify: typecheck, focused tests, production build; deploy with `npx vercel --prod --yes`

---

## 17. Prior art (still relevant)

- `docs/ADMIN_DASHBOARD_PERFORMANCE_AUDIT.md` (2026-07-09) — dashboard payload diet, virtualization, shell session fix  
- `docs/PRODUCTION_READINESS_PERFORMANCE.md` — idle polls, prefetch, loading skeletons  
- `docs/ENTERPRISE_PERFORMANCE_RECOVERY.md` — historical critical path (mostly mitigated on dashboard)

**Delta since those docs:** Dashboard critical path is largely fixed; **inventory/leads/sales/customers + polling thrash** are now the primary interaction bottlenecks.

---

## 18. Phase 2 — implemented (2026-07-28)

| Change | Why | Files |
|--------|-----|-------|
| Parallel `GET /api/admin/inquiries` | Remove sequential waterfall across lead tables + profiles | `src/app/api/admin/inquiries/route.ts` |
| Vehicles `fields=list` default; edit uses `fields=full` | Cut gallery/description blob payload on inventory/sales | `vehicle-columns.ts`, `vehicles/route.ts`, `inventory/[id]/edit/page.tsx` |
| Notification poll dedupe (`pollFallback: false`) | Stop 30s+60s duplicate `/api/admin/notifications` thrash | `realtime.ts`, `admin-notifications-context.tsx` |
| Parallel notification post-queries + route preloads | Fewer RTTs per poll | `notifications.ts`, `notifications/route.ts` |
| Idle-defer dashboard insights | KPI fetch no longer competes with chart-vehicles | `dashboard/page.tsx` |
| `optimizePackageImports` for lucide/recharts | Smaller cold parse of icon/chart graphs | `next.config.ts` |
| Migration `083_admin_interaction_indexes.sql` | Status/recipient/stock indexes — **user must run** | `supabase/migrations/083_*.sql` |

**Verified:** `npm run typecheck` pass; `npm run build` pass; platform/admin unit tests 87/87 assertions (pre-existing `admin-notification-trash` suite import/`server-only` issue unchanged).

**Deploy:** production via `npx vercel --prod --yes` after this section.

---

*End of audit + Phase 2 notes.*
