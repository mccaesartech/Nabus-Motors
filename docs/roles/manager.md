# Manager Guide

The **Manager** runs day-to-day sales and operations: inventory, leads, customers, sales, documents, website content, and both chat systems. Managers do not have access to finance, reports, user management, settings, or the activity log.

---

## Role overview

- **Who:** Sales manager, showroom lead, or department head
- **Access level:** Operational — most customer-facing and inventory tools
- **Login URL:** `/admin`
- **How to sign in:**
  1. Open `/admin`
  2. Enter your **email** and **password**
  3. Click **Sign In**

First-time users accept an invite at `/platform/invite/[token]` and set a password.

---

## Permissions summary

### You CAN

| Area | What you can do |
|------|-----------------|
| Dashboard | View stats, charts, recent leads and transactions |
| Inventory | List, add, edit, delete vehicles; use AI Editor; export CSV |
| Leads | View all inquiry types; update status, source, notes; manage pre-orders |
| Customers | Browse aggregated customer profiles; open detail; start messages |
| Sales | Create, update, complete, and revert sales; convert pre-orders |
| Documents | Generate and save agreements and invoices |
| Site content | Edit public website copy, images, and videos |
| Support tickets | Claim, reply, close, and start customer conversations |
| Team chat | All Staff, direct messages, create/manage groups |
| Notifications | View and manage alerts |
| Search | Global search across vehicles, leads, customers, sales, messages |

### You CANNOT

| Area | Reason |
|------|--------|
| Finance | Owner / Super Admin only |
| Reports | Owner / Super Admin only |
| Users & invites | Owner / Super Admin only |
| Settings | Owner / Super Admin only |
| Activity log | Owner / Super Admin only |

If you visit a restricted URL (e.g. `/platform/finance`), you are redirected to the dashboard.

---

## Platform features (step-by-step)

### Dashboard

**URL:** `/platform/dashboard`

1. Sign in to see inventory stats, pre-order pipeline, and lead counts.
2. Use quick actions to add vehicles or review new leads.
3. Click recent items to jump to Leads or Inventory.

---

### Inventory

**URLs:** `/platform/inventory` · `/platform/inventory/new` · `/platform/inventory/[id]/edit`

**Browse and filter**

1. Open **Inventory** from the sidebar.
2. Search or use category chips and dropdown filters.
3. Export filtered results to CSV.

**Add a vehicle**

1. Click **Add vehicle**.
2. Complete vehicle details and upload photos (exterior, interior, engine, other).
3. Use the **AI Editor** to draft descriptions, find stock photos, or adjust image filters.
4. Save — the listing syncs to the public website.

**Edit or remove**

1. Click a vehicle row → edit fields → save.
2. Delete with confirmation when a listing should be removed.

---

### Leads

**URLs:** `/platform/leads` · `/platform/leads/preorder/[id]`

1. Open **Leads**.
2. Filter by type: Contact, Vehicle, Pre-order, Finance, Trade-in.
3. Filter by status (new, pending, contacted, qualified, closed, sold) or source (website, WhatsApp, phone, etc.).
4. Expand a row to change status, source, or follow-up notes.
5. Delete leads you no longer need (with confirmation).

**Pre-order detail page**

1. Click a pre-order row’s detail link.
2. Review customer info, vehicle, and payment status.
3. Update lead status, payment status, and notes.
4. **Convert to sale** when the deal is ready.
5. **Revert to pre-order** if a sale was converted by mistake.
6. Link opens related customer profile and public vehicle page.

---

### Customers

**URLs:** `/platform/customers` · `/platform/customers/[id]`

1. Open **Customers** for a unified contact list from all form submissions and registrations.
2. Search by name, email, phone, or registration ID.
3. Open a profile to see inquiry history and contact actions (email, phone).
4. Click **Message** to open Support Tickets with that customer selected.

---

### Sales

**URL:** `/platform/sales`

1. View the sales pipeline and summary stats.
2. **New sale:** pick vehicle, enter customer name/email, sale price, valid-until date, notes.
3. **From pre-order:** select a convertible pre-order or convert from the pre-order detail page.
4. Update status through the lifecycle: draft → pending → completed.
5. **Complete sale** marks the vehicle as sold.
6. **Revert** undoes a completion when needed.
7. Export sales to CSV.

---

### Documents

**URL:** `/platform/documents`

1. Choose document type: Sales Agreement, Pre-Order Agreement, or Invoice.
2. Select vehicle and customer name.
3. **Print / preview** opens a formatted document for printing or PDF save.
4. Save external document URLs to the library for reference.

---

### Site content (CMS)

**URL:** `/platform/site-content`

Managers can edit what visitors see on the public website.

1. Open **Site Content**.
2. Select a tab: Global, Homepage, Why Choose Us, Browse by Category, Testimonials, About, Footer, Header, Contact, Buy, Sell, Financing.
3. Edit headlines, body text, buttons, images, or videos.
4. Save each section independently.
5. Use **Preview** to open the live page and verify.

> Coordinate with Owner/Super Admin on major branding changes.

---

### Support tickets (customer messages)

**URL:** `/platform/messages`

1. Open **Messages**.
2. Tabs: **Open queue** (unassigned), **My tickets** (yours), **Closed**.
3. **Accept ticket** to claim from the queue.
4. Reply in the thread. Use **Draft with AI** for suggested responses (if configured).
5. **Close ticket** with an optional resolution note.
6. **New conversation** — pick a customer, category, subject, and first message.

**Ticket categories:** General, Pre-order, Financing, Processing

**Ticket statuses:** open → claimed (assigned to you) → closed (customer can reopen)

---

### Team chat

**URL:** `/platform/team-chat`

1. **All Staff** — read and post in the company channel.
2. **Direct messages** — click **New message**, pick a colleague or Owner.
3. **Groups** — you can **create groups** and manage members (add/remove, rename).
4. Unread badges appear on the sidebar Team Messages item.

---

### Notifications

**URL:** Bell icon · `/platform/notifications`

- Pre-orders, contact forms, finance applications, appraisals, team messages, and more
- Click to navigate to the related lead or page
- Mark read individually or all at once

---

### Search

**URL:** Top bar or `/platform/search`

Type 2+ characters to find vehicles, customers, leads, sales, and message threads.

---

### Currency selector

Use the top-bar currency dropdown to display prices in your preferred currency (display only; stored values are USD).

---

## Common workflows

### Process a pre-order from start to finish

1. Notification or Leads tab → open pre-order
2. Contact customer via Messages or phone
3. On pre-order detail, set payment status to **25% paid** when deposit received
4. Update lead status to **qualified** or **contacted**
5. When deal closes → **Convert to sale** → complete sale on Sales page

### Claim a customer support ticket

1. `/platform/messages` → **Open queue**
2. Select conversation → **Accept ticket**
3. Reply → **Close ticket** when resolved

### Publish a new featured vehicle

1. `/platform/inventory/new` → add details and photos (AI Editor optional)
2. Mark as **Featured** if it should appear on the homepage
3. Set status **Available**
4. Verify on public `/inventory`

### Create a sales team group chat

1. `/platform/team-chat` → **Create group**
2. Name it (e.g. "Sales Floor") → select members → save
3. Use for daily coordination

---

## Tips & limitations

- **No finance access:** Revenue and expense totals are on the Finance page — ask Owner or Super Admin for exports.
- **No user invites:** Request new staff accounts from Owner or Super Admin.
- **Site content:** Changes are live after save — preview before publishing large updates.
- **AI Editor:** Helpful for listings but optional; real vehicle photos give the best results.
- **Pre-order payment:** Payment status is updated manually in the platform when you confirm receipt offline.

See also: [README — permission comparison](./README.md#quick-permission-comparison)
