# Staff Guide

The **Staff** role is for front-line team members who handle inventory, incoming leads, customer support tickets, and internal team chat. Staff have a focused workspace without access to customers list, sales, finance, documents, site content, reports, users, or settings.

---

## Role overview

- **Who:** Sales officer, reception, inventory clerk, or support agent
- **Access level:** Front-line — dashboard, inventory, leads, messages, team chat
- **Login URL:** `/admin`
- **How to sign in:**
  1. Open `/admin`
  2. Enter your **email** and **password**
  3. Click **Sign In**

New staff accept an invite at `/platform/invite/[token]` and create a password on first visit.

---

## Permissions summary

### You CAN

| Area | What you can do |
|------|-----------------|
| Dashboard | View overview stats and recent activity |
| Inventory | View, add, edit, delete vehicles; use AI Editor; export CSV |
| Leads | View and update all lead types including pre-orders |
| Support tickets | Claim, reply, close, and start customer conversations |
| Team chat | All Staff channel, direct messages, participate in groups |
| Notifications | View alerts and open linked pages |
| Search | Find vehicles, leads, and messages (within your access) |

### You CANNOT

| Area |
|------|
| Customers (aggregated profiles) |
| Sales |
| Finance |
| Documents |
| Site content (CMS) |
| Reports |
| Users & invites |
| Settings |
| Activity log |
| Create team chat groups (you can post in groups others create) |

Restricted pages redirect you to `/platform/dashboard`.

---

## Your sidebar

When signed in, you see:

- Dashboard
- Inventory
- Leads
- Messages
- Team Messages

Plus top-bar tools: **Search**, **Notifications**, **Currency**, **Sign out**.

---

## Platform features (step-by-step)

### Dashboard

**URL:** `/platform/dashboard`

1. After sign-in, review high-level numbers: vehicles on lot, pre-orders, new leads.
2. Scan recent leads and activity feeds.
3. Use links to jump into Leads or Inventory.

You see the same dashboard layout as other roles; some financial detail may reference data you cannot open directly.

---

### Inventory

**URLs:** `/platform/inventory` · `/platform/inventory/new` · `/platform/inventory/[id]/edit`

**View inventory**

1. Open **Inventory**.
2. Search by keyword or filter with chips (make categories, body type, status, etc.).
3. Download CSV export of the current view.

**Add a vehicle**

1. Click **Add vehicle** (top right or dashboard quick action).
2. Fill in make, model, year, price, mileage, VIN, description, and location.
3. Upload photos:
   - **Exterior** — at least one hero shot
   - **Interior** — cabin, seats, dashboard
   - **Engine** — engine bay
   - **Other** — optional extras
4. Open the **AI Editor** (optional):
   - Ask it to write or improve the description
   - Request stock photo ideas (needs make/model filled in)
   - Apply photo filters
5. Set **Status** (available, reserved, pre-order, sold).
6. Save — listing goes live on the public site shortly.

**Edit a listing**

1. Click a vehicle in the list.
2. Update any field and save.

**Remove a listing**

1. Open the vehicle → delete → confirm.

---

### Leads

**URLs:** `/platform/leads` · `/platform/leads/preorder/[id]`

Leads collect every inquiry from the public website: contact messages, vehicle interest, pre-orders, financing, and trade-in appraisals.

**Work the leads list**

1. Open **Leads**.
2. Use the type filter: All, Contact, Vehicle, Pre-order, Finance, Trade-in.
3. Filter by status or source.
4. Search by customer name, email, or vehicle.
5. Expand a row to update:
   - **Status** — new, pending, contacted, qualified, closed, sold
   - **Source** — website, WhatsApp, phone, walk-in, referral, social
   - **Follow-up notes** — free text for your next action
6. Changes save when you edit fields.

**Pre-order detail**

1. Click through to `/platform/leads/preorder/[id]` for pre-orders.
2. Review customer details, vehicle, deposit amount, and payment status.
3. Update notes and lead status.
4. You can update payment status when a manager confirms deposit receipt.

> Converting pre-orders to sales requires Sales access (Manager or above). Ask your manager to convert when the deal is ready.

**Delete a lead**

Use the delete action with confirmation for spam or duplicate entries.

---

### Support tickets (customer messages)

**URL:** `/platform/messages`

This is your primary tool for helping logged-in customers who message the team through their account.

**Understand the queues**

| Tab | Meaning |
|-----|---------|
| **Open queue** | New or unassigned tickets — anyone can claim |
| **My tickets** | Conversations assigned to you |
| **Closed** | Resolved tickets (customer may reopen) |

**Claim a ticket**

1. Open **Messages** → **Open queue**.
2. Click a conversation to read the thread.
3. Click **Accept ticket**.
4. The ticket moves to **My tickets** and other agents see you as the assignee.

**Reply**

1. Type in the message box at the bottom.
2. Optional: expand **Draft with AI** → pick an intent (e.g. acknowledge, answer pre-order question) → edit the suggested text → send.
3. Press send or click the send button.

**Close a ticket**

1. When the issue is resolved, enter an optional **Resolution note**.
2. Click **Close ticket**.
3. The conversation moves to **Closed**.

**When a customer reopens**

If they send a new message on a closed ticket, it re-enters the **Open queue** for any agent to claim. Previous history is preserved.

**Start a new conversation**

1. Click **New conversation**.
2. Select a customer from the dropdown (registered accounts and leads with email).
3. Choose **Category**: General, Pre-order, Financing, or Processing.
4. Enter **Subject** and first message.
5. Send — the ticket is assigned to you under **My tickets**.

**Search tickets**

Use the search box for customer name, email, registration ID, pre-order title, or message text.

---

### Team chat

**URL:** `/platform/team-chat`

**All Staff channel**

1. Open **Team Messages**.
2. Select **All Staff** at the top of the channel list.
3. Read and post messages visible to every team member.

**Direct message**

1. Click **New message** (or the compose control).
2. Pick a colleague or Owner from the list.
3. Send your message.

**Group chats**

- You can read and post in groups created by Manager, Super Admin, or Owner.
- You cannot create new groups or manage membership.

Unread counts show on the sidebar when you have new team messages.

---

### Notifications

**URL:** Bell icon in top bar · `/platform/notifications`

1. Click the bell for recent events: new pre-orders, contact forms, vehicle inquiries, team mentions, etc.
2. Click a notification to open the related lead or page.
3. Mark as read or clear old items.

---

### Search

**URL:** Top bar search · `/platform/search`

1. Type at least 2 characters.
2. Results include vehicles, leads, and messages (and other types you may not have sidebar access to — links still work if shared by a colleague).
3. Click a result to open it.

---

### Currency selector

The top-bar dropdown changes how prices display in the platform. It does not change stored prices.

---

## Common workflows

### Morning routine

1. Check **Notifications** for overnight pre-orders and contact forms
2. Open **Leads** → filter status **new** → update and add follow-up notes
3. Open **Messages** → clear **Open queue** tickets you can handle

### Add a vehicle a customer traded in

1. `/platform/inventory/new`
2. Enter details and upload real photos
3. Set status **Available** (or **Reserved** if spoken for)
4. Save and share the public `/inventory/[slug]` link with the team

### Help a customer waiting on a pre-order update

1. Find their pre-order in **Leads** (Pre-order tab) or via **Search**
2. Open pre-order detail → read notes and payment status
3. Open **Messages** → find or start their conversation
4. Reply with an update → close ticket when done

### Escalate to a manager

When you need Sales, Finance, or site changes:

- Note the lead ID or customer email
- Message your manager in **Team chat** (direct or group)
- Manager converts pre-orders, completes sales, or updates CMS

---

## Tips & limitations

- **Stay in your lane:** Attempting `/platform/sales` or `/platform/customers` redirects you — that is expected.
- **Claim before replying:** Accept open-queue tickets so customers know who is helping them.
- **AI reply assist:** Works only if the server has `GEMINI_API_KEY`; you can always type manually.
- **Registration IDs:** Customers have IDs like `TGA-…` — search by this in Messages or Leads.
- **Activity tracking:** Your sign-ins and actions are logged for Owner/Super Admin review.
- **Sign out:** Use **Sign out** in the top bar on shared computers.

See also: [README — permission comparison](./README.md#quick-permission-comparison)
