# Admin Dashboard UX Redesign

Enterprise-grade information architecture and dashboard UX for the True Goshen platform admin (`/platform/*`). Brand colors, routes, and permissions are unchanged — this release improves organization, hierarchy, workflow, accessibility, and performance.

## What Changed

### Sidebar (Information Architecture)

Navigation is grouped by business department with expandable sections:

| Department | Routes |
|------------|--------|
| **Dashboard** | `/platform/dashboard` |
| **Sales** | `/platform/sales`, `/platform/leads`, `/platform/appointments` |
| **Operations** | `/platform/tracking`, `/platform/documents` |
| **Inventory** | `/platform/inventory` |
| **Freight** | `/platform/freight/orders`, `/platform/freight/quotes`, `/platform/freight/tracking`, `/platform/freight/documents` |
| **Spare Parts** | `/platform/parts/categories`, `/platform/parts/inventory`, `/platform/parts/published` |
| **Finance** | `/platform/finance` |
| **Marketing** | `/platform/reports`, `/platform/site-content` |
| **Customers** | `/platform/customers`, `/platform/messages` |
| **Administration** | `/platform/team-chat`, `/platform/emails`, `/platform/account-lifecycle`, `/platform/trash`, `/platform/users`, `/platform/settings` |

**Sidebar features:**
- Expandable department groups (state persisted in `localStorage`)
- Active section highlighting via route → group mapping
- Sidebar search (filters nav items)
- Favorites (star icon, `localStorage`)
- Recently visited pages (`localStorage`)
- Collapsed rail mode preserved for mobile/desktop

### Home Dashboard

Structured for decisions: *What needs attention? What happened today? What next? Business health?*

1. **Welcome header** — greeting, date, role persona, business summary
2. **Business KPIs** — role-tailored large stat cards
3. **Quick actions** — Add vehicle, spare part, shipment, quote, customer, appointment
4. **Attention center** — urgent issues, pending tasks, delayed shipments, low stock, unread messages, failed payments
5. **Today's activity** — timeline from notifications, leads, and activity log
6. **Business insights** — lazy-loaded Recharts (inventory pie, lead pipeline bar)
7. **Recent transactions & lead tracking** — `EnhancedDataTable` with sort, column visibility, pagination

### Role-Based KPI Mapping

Platform roles (`owner`, `super_admin`, `manager`, `staff`) map to dashboard **personas** without changing `permissions.ts`:

| Persona | Resolved when | Primary KPIs |
|---------|---------------|--------------|
| **CEO** | `owner`, `super_admin`, or `reports` permission | Revenue, available vehicles, reservations, shipments, appointments, messages, leads, sold |
| **Sales** | `sales` or `leads` permission (default staff) | Open leads, appointments, reservations, pre-orders, revenue, messages |
| **Inventory** | `inventory_edit` or manager + inventory | Available, reservations, low stock, pre-orders, sold |
| **Operations** | `manager` or finance-only staff | Shipments, appointments, leads, reservations, messages |
| **Freight** | `freight` without sales/inventory edit | Pending shipments, freight quotes, messages, leads |
| **Customer Support** | `staff` with messages, without sales | Messages, leads, appointments, reservations |

Legacy job titles (e.g. Sales Officer, Finance Officer) continue to normalize via `normalizeRole()` in `permissions.ts`.

### Tables

New `EnhancedDataTable` component (`src/components/platform/enhanced-data-table.tsx`):

- Sticky headers (via existing `.platform-table` CSS)
- Column sort
- Column visibility toggle
- Pagination
- Optional search toolbar
- Responsive scroll container

Applied on dashboard recent transactions and lead tracking. High-traffic list pages (customers, inventory, leads) use sticky scroll wrappers; full migration to `EnhancedDataTable` can proceed incrementally where row expansion/bulk actions allow.

### Notification Center

Header bell dropdown groups notifications:

- **Urgent** — low stock, pending vehicle approval, reopened tickets
- **Warnings** — pre-orders, finance, freight quotes, trade-ins
- **Information** — other unread items
- **Completed** — read notifications

Full page remains at `/platform/notifications`.

### Visual Hierarchy

- Increased main content padding (`p-5 lg:p-8`)
- Larger dashboard section spacing (`space-y-8`)
- Grouped cards with clearer primary/secondary/tertiary typography
- Lucide icons for actions and KPIs
- WCAG 2.2 AA: semantic landmarks, `aria-label`, focus states, screen-reader labels

### Performance

- Dynamic imports for charts (`business-insights`, existing `dashboard-charts`)
- Skeleton loaders for KPIs, charts, activity timeline
- Client-side parallel fetches to existing APIs (no new aggregate endpoint required)

## Files Created

```
src/lib/platform/sidebar-storage.ts
src/lib/platform/dashboard-role-kpis.ts
src/components/platform/dashboard/welcome-header.tsx
src/components/platform/dashboard/kpi-cards.tsx
src/components/platform/dashboard/quick-actions.tsx
src/components/platform/dashboard/attention-center.tsx
src/components/platform/dashboard/activity-timeline.tsx
src/components/platform/dashboard/business-insights.tsx
src/components/platform/sidebar-search.tsx
src/components/platform/sidebar-favorites.tsx
src/components/platform/enhanced-data-table.tsx
docs/ADMIN_DASHBOARD_UX_REDESIGN.md
```

## Files Modified

```
src/lib/platform/nav.ts
src/components/platform/sidebar.tsx
src/components/platform/platform-shell.tsx
src/components/platform/notification-center.tsx
src/app/platform/dashboard/page.tsx
src/app/platform/customers/page.tsx (sticky scroll wrapper)
```

## APIs Used (unchanged routes)

| Endpoint | Dashboard use |
|----------|---------------|
| `GET /api/admin/stats` | KPIs, attention center, charts |
| `GET /api/admin/notifications` | Attention, activity timeline |
| `GET /api/admin/vehicles` | Recent transactions |
| `GET /api/admin/inquiries` | Leads, failed payments |
| `GET /api/admin/dashboard/transactions` | Dismissed transaction IDs |
| `GET /api/admin/activity` | Activity timeline (owners/admins) |
| `GET /api/admin/appointments` | Appointments today KPI |
| `GET /api/admin/freight/shipments` | Pending/delayed shipments |
| `GET /api/admin/freight/quotes` | Open freight quotes KPI |

## Constraints Preserved

- No URL changes under `/platform/*`
- No feature removal
- Purple brand theme (`--platform-accent: #8b5cf6`) unchanged
- Existing permission checks and `navPermissionForHref()` unchanged
