# Owner Guide

The **Owner** is the dealership principal with full access to every platform feature. The Owner signs in with a master password — not an email account — and is not listed as an inviteable team user.

---

## Role overview

- **Who:** Business owner or primary administrator
- **Access level:** Full — every permission in the system
- **Login URL:** `/admin` (e.g. `https://yoursite.com/admin`)
- **How to sign in:**
  1. Open `/admin`
  2. Leave the **Email** field **blank**
  3. Enter the **master password** (`ADMIN_PASSWORD` on the server)
  4. Click **Sign In**

You are redirected to `/platform/dashboard`.

> **Note:** Team members sign in with email + password on the same page. Only the Owner uses the blank-email + master-password flow.

---

## Permissions summary

### You CAN

- Use every section in the platform sidebar
- Invite Super Admins, Managers, and Staff
- View and export finance data and reports
- Change platform settings and company profile
- View the full activity audit log
- Create and manage team chat groups
- Claim, reply to, and close customer support tickets
- Edit all public website content
- Add, edit, and delete inventory
- Manage sales, documents, leads, and customers

### You CANNOT

- Be removed or disabled through the Users page (you are not a `platform_users` row)
- Reset the master password from inside the app (change `ADMIN_PASSWORD` in server environment variables)

---

## Platform features (step-by-step)

### Dashboard

**URL:** `/platform/dashboard`

1. Sign in and land on the dashboard automatically.
2. Review stat cards: inventory counts, pre-order pipeline, revenue estimates, new leads.
3. Scan charts for inventory status and lead pipeline.
4. Use quick links to add a vehicle, view leads, or open notifications.
5. Click any recent lead or transaction row to jump to the detail page.

---

### Inventory

**URLs:** `/platform/inventory` · `/platform/inventory/new` · `/platform/inventory/[id]/edit`

**List vehicles**

1. Open **Inventory** in the sidebar.
2. Search by make, model, or keyword.
3. Filter by body type, status, transmission, fuel, featured, or brand origin using chips and dropdowns.
4. Click a row to edit, or use **Export CSV** to download the filtered list.

**Add a vehicle**

1. Click **Add vehicle** (or go to `/platform/inventory/new`).
2. Fill in make, model, year, price, mileage, specs, and description.
3. Upload photos by category: exterior, interior, engine, other.
4. Use the **AI Editor** panel to:
   - Generate or refine listing descriptions
   - Get stock photo suggestions from Pexels
   - Apply photo filters (brightness/contrast presets)
5. Set status (available, reserved, pre-order, sold) and save.
6. The listing appears on the public site within about a minute.

**Edit or delete**

1. Open a vehicle from the inventory list.
2. Update fields and save, or delete with confirmation.

---

### Leads

**URLs:** `/platform/leads` · `/platform/leads/preorder/[id]`

1. Open **Leads** in the sidebar.
2. Filter by type (contact, vehicle inquiry, pre-order, finance, trade-in), status, or source.
3. Search by name, email, or vehicle.
4. Expand a row to update **status**, **source**, or **follow-up notes** — changes save automatically.
5. For pre-orders, click the detail link to open `/platform/leads/preorder/[id]` where you can:
   - Update payment status (pending → 25% paid → completed / cancelled)
   - Add follow-up notes
   - Convert to a sale
   - Revert a converted sale back to pre-order
   - Delete the lead

---

### Customers

**URLs:** `/platform/customers` · `/platform/customers/[id]`

1. Open **Customers** for a unified view of everyone who submitted a form or registered.
2. Search by name, email, phone, or registration ID.
3. Click a customer to see their lead history and contact details.
4. Use **Message** to start a support conversation (opens Messages with that customer pre-selected).

---

### Sales

**URL:** `/platform/sales`

1. Open **Sales** to manage deals and quotes.
2. View stat cards for pipeline value and completed sales.
3. **Create a sale manually:** click **New sale**, pick a vehicle, enter customer details, sale price, and valid-until date.
4. **Convert from pre-order:** use the pre-order picker or convert from the pre-order detail page.
5. Update sale status (draft → pending → completed).
6. **Complete** a sale to mark the vehicle sold.
7. **Revert** a completed sale if needed.
8. Export sales to CSV.

---

### Finance

**URL:** `/platform/finance`

1. Open **Finance** to see revenue summary (sold + pre-order deposits) vs expenses.
2. Add expenses with description, amount, and date.
3. Remove incorrect expense rows.
4. Export the expense ledger to CSV.

---

### Support tickets (customer messages)

**URL:** `/platform/messages`

1. Open **Messages** in the sidebar.
2. Use tabs: **Open queue**, **My tickets**, **Closed**.
3. **Claim a ticket:** select an open conversation → click **Accept ticket** → it moves to **My tickets**.
4. **Reply:** type in the message box and send. Use **Draft with AI** for Gemini-assisted replies (requires `GEMINI_API_KEY`).
5. **Close:** add an optional resolution note → **Close ticket**.
6. **Start a new conversation:** click **New conversation** → pick a customer → set category and subject → send the first message.
7. When a customer reopens a closed ticket, it returns to the open queue for any agent to claim.

**Categories:** General, Pre-order, Financing, Processing

---

### Team chat

**URL:** `/platform/team-chat`

1. Open **Team Messages** in the sidebar.
2. Channels available:
   - **All Staff** — company-wide channel
   - **Groups** — create named groups (Owner can create and manage)
   - **Direct** — one-to-one with any team member or Owner
3. **Start a direct chat:** click **New message** → pick a recipient → send.
4. **Create a group:** click **Create group** → name it → select members → save.
5. **Manage a group:** open the group → gear icon → add/remove members or rename.

Messages update in real time. Unread counts appear in the sidebar.

---

### Documents

**URL:** `/platform/documents`

1. Open **Documents**.
2. Pick a document type: Sales Agreement, Pre-Order Agreement, or Invoice Template.
3. Select a vehicle and customer name.
4. Click **Print / preview** to generate a printable document.
5. Optionally save an external file link to the document library.

---

### Reports

**URL:** `/platform/reports`

1. Open **Reports**.
2. Optionally set a **From** and **To** date (leave blank for all records).
3. Export CSV for:
   - Inventory
   - Leads
   - Pre-orders
   - Sales

---

### Users & team invites

**URLs:** `/platform/users` · `/platform/invite/[token]` · `/platform/users/activity`

**Invite someone**

1. Open **Users**.
2. Enter name, email, and role (Super Admin, Manager, or Staff).
3. Click **Send invite**.
4. If email is configured (Resend), they receive a link automatically. Otherwise, copy the invite link from the panel and share it manually.
5. The invitee opens `/platform/invite/[token]`, sets a password, and lands on the dashboard.

**Manage existing users**

- Change role from the dropdown on each row
- **Resend email** or **Copy invite link** for pending users
- **Remove** a user (cannot remove yourself; Owner is not in this list)

**Activity log**

1. Click **Activity log** on the Users page (or go to `/platform/users/activity`).
2. Review sign-ins, vehicle changes, lead updates, team messages, exports, and more.

---

### Site content (CMS)

**URL:** `/platform/site-content`

1. Open **Site Content**.
2. Choose a section tab: Global, Homepage, Why Choose Us, Browse by Category, Testimonials, About, Footer, Header, Contact, Buy, Sell, Financing.
3. Edit text, images, or videos for that section.
4. Click **Save** on the section bar.
5. Use **Preview** links to open the live public page and verify changes.

---

### Settings

**URL:** `/platform/settings`

1. Open **Settings**.
2. Update company name, phone, email, address, WhatsApp number, and notification email.
3. Click **Save changes**. These values appear on documents, forms, and customer communications.

---

### Notifications

**URLs:** Bell icon in top bar · `/platform/notifications`

1. Click the bell icon for recent alerts (pre-orders, contacts, finance applications, team messages, etc.).
2. Click a notification to open the linked page.
3. Mark individual items read or **Mark all read**.
4. Open `/platform/notifications` for the full history.

---

### Search

**URL:** `/platform/search` (also available in the top bar)

1. Type at least 2 characters.
2. Results are grouped by vehicles, customers, leads, sales, and messages.
3. Click any result to open the detail page.

---

### Currency selector

Use the currency dropdown in the platform top bar to view prices in your preferred currency. This affects display only in the admin portal; stored prices are in USD.

---

## Common workflows

### Invite your first Super Admin

1. `/platform/users` → enter name, email, role **Super Admin** → **Send invite**
2. Share the link if email is not configured
3. They accept at `/platform/invite/[token]` and set a password

### Handle a new pre-order

1. Check dashboard or notifications for the alert
2. Open `/platform/leads?tab=preorder` → find the lead
3. Open pre-order detail → update payment status when deposit is received
4. Message the customer from `/platform/messages` or the customer profile
5. When ready, **Convert to sale** on the pre-order detail page

### Claim and resolve a support ticket

1. `/platform/messages` → **Open queue** tab
2. Select ticket → **Accept ticket**
3. Reply (optionally use AI assist) → **Close ticket** with a resolution note

---

## Tips & limitations

- **Session:** Owner sessions last 12 hours. Team member sessions last longer (platform session cookie).
- **Master password:** Store `ADMIN_PASSWORD` securely. Changing it requires updating the server environment and redeploying.
- **AI features:** Vehicle AI Editor and message reply assist need `GEMINI_API_KEY`. Without it, you can still type everything manually.
- **Email invites:** Configure `RESEND_API_KEY` and `RESEND_FROM_EMAIL` for automatic invite emails.
- **Owner vs Super Admin:** Permissions are identical in the app. The difference is login method (master password vs email) and that the Owner account cannot be disabled from the Users page.
