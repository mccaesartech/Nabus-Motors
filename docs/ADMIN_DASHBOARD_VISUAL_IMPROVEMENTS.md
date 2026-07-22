# Admin Dashboard Visual Improvements

Visual hierarchy and engagement updates for the True Goshen platform dashboard — **no routing changes**, **no feature removal**, purple brand preserved.

## Grid structure

### Page layout (`page.tsx`)

```
Welcome header
KPI cards (auto-fill responsive grid)
Quick actions
Attention center
┌─────────────────────────────┬──────────────────────────────────┐
│ Today's Activity (timeline) │ Business Insights (responsive grid) │
└─────────────────────────────┴──────────────────────────────────┘
Recent transactions │ Lead tracking
```

- Activity + Insights: `xl:grid-cols-[0.95fr_1.25fr]` — balances density without stretching cards.
- Section spacing reduced from `space-y-8` → `space-y-5`.

### Business Insights grid

| Row | Columns | Condition |
|-----|---------|-----------|
| 1 | Inventory Availability · Lead Pipeline | `permissions.inventory` / `permissions.leads` |
| 2a | Sales Trend · Vehicle Categories | inventory + vehicle data |
| 2b | Revenue Trend · Freight Status | freight/sales persona when 2a unavailable |
| 3a | Recent Orders · Top Selling Vehicles | sold/reserved vehicles exist |
| 3b | Monthly Performance Summary | fallback when no order data |

Cards use `auto-fill minmax(340px, 1fr)` on large screens.

## Design tokens (`src/lib/platform/design-tokens.ts`)

- **Primary:** purple, lavender (brand — unchanged)
- **Semantic (status only):** emerald success, amber warning, red danger, blue info, gray neutral
- **Surfaces:** card white, light gray background, soft purple hover tint

## New components

| File | Purpose |
|------|---------|
| `empty-state.tsx` | Icon + message + CTA — no blank whitespace |
| `sparkline.tsx` | Lightweight SVG sparklines for KPIs |
| `kpi-trend.tsx` | Trend arrows, animated counters, progress rings |
| `chart-time-range.ts` | Today / Week / Month / Year filters |

## Microinteractions (`platform.css`)

- `.platform-dashboard-card` — hover lift (`translateY(-1px)`) + soft shadow
- Chart fade-in, bar grow animation, progress ring transition
- CSS-only — no framer-motion

## Charts (`dashboard-charts.tsx`)

- Lazy-loaded via `dynamic()` in `business-insights.tsx`
- Recharts with 700ms ease-out animation
- Improved tooltips with percentage
- Time range filter on Sales Trend & Revenue Trend

## Activity timeline

- Grouped: **Today · Yesterday · Earlier**
- Icon types: Vehicle, Shipment, Customer, Payment, Message, Approval, Support, Appointment
- Semantic icon colors; status pills; responsible user shown

## KPI cards

- Animated counters on mount
- Trend indicators (▲/▼ %)
- Mini sparklines
- Optional progress rings
- Status chips (Alert / Action / Healthy)

## Data sources

No new API routes. Composed from:

- `/api/admin/stats` → `PlatformStats`
- `/api/admin/vehicles` → category/sales charts
- Client `extras` → freight counts, appointments
