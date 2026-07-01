# Customer Guide

A **Customer** is anyone who creates an account on the True Goshen Auto public website. Customers can pre-order vehicles, track inquiries, save favorites, and message the dealership through a built-in support ticket system.

---

## Role overview

- **Who:** Car buyer, pre-order customer, or registered visitor
- **Access level:** Public account features only (not the admin platform)
- **Register:** `/register`
- **Sign in:** `/login`
- **Account home:** `/account`

There is no access to `/admin` or `/platform/*` with a customer account.

---

## Permissions summary

### You CAN

| Feature | Description |
|---------|-------------|
| Browse inventory | Full catalog with filters and search |
| Switch currency | View prices in your preferred currency |
| Pre-order vehicles | Submit 25% deposit pre-orders (one per vehicle) |
| Create an account | Register with email and password |
| Track pre-orders | See status and payment stage in My Account |
| View inquiries | Contact, vehicle, and finance submissions linked to your email |
| Message the team | Open support tickets and chat with assigned agents |
| Reopen closed tickets | Send a message to reopen a resolved conversation |
| Save vehicles | Heart/save listings to My Garage |
| Recently viewed | See vehicles you browsed in My Garage |

### You CANNOT

| Limitation |
|------------|
| Access the admin platform (`/admin`, `/platform/*`) |
| See other customers' data |
| Edit inventory or website content |
| Claim or assign support tickets (staff-only) |
| Complete pre-order payment inside the app (deposit is arranged offline with the team) |

---

## Getting started

### Create an account

1. Go to `/register`
2. Enter full name, email, phone, and password (minimum 8 characters)
3. Confirm password and submit
4. If email confirmation is disabled, you land on `/account?welcome=1` immediately
5. Otherwise, check your email, then sign in at `/login`

### Sign in

1. Go to `/login`
2. Enter email and password
3. You are redirected to `/account` (or the page you came from)

### Sign out

Use **Sign out** from the account page or site header when logged in.

---

## Public website features

### Browse inventory

**URLs:** `/inventory` · `/inventory/[slug]`

1. Open **Inventory** from the site menu.
2. Filter by make, price, body type, year, and more.
3. Click a vehicle for photos, specs, description, and price.
4. Switch **currency** with the site selector to see converted prices.

### Pre-order a vehicle

**URL:** Vehicle detail page → **Pre-Order This Vehicle**

Pre-orders require a **25% down payment**, arranged with the team after you submit.

**If you are signed in**

1. Open the vehicle page.
2. Click **Pre-Order This Vehicle**.
3. Confirm your name, email, and phone (pre-filled from your profile).
4. Add an optional message.
5. Acknowledge the 25% deposit requirement.
6. Submit.
7. Track the pre-order under `/account`.

**If you are not signed in (guest)**

1. Click **Pre-Order This Vehicle**.
2. Enter your details and create a password in the dialog (account created as part of checkout).
3. Submit — you can sign in afterward to track status.

**Multiple pre-orders**

You may pre-order more than one vehicle; each requires its own 25% deposit.

**WhatsApp alternative**

Each pre-order dialog includes a WhatsApp link if you prefer to coordinate by chat.

### My Garage (saved vehicles)

**URL:** `/garage` (requires sign-in)

1. Sign in, then open **My Garage**.
2. **Saved** tab — vehicles you hearted/saved.
3. **Recently viewed** — browsing history.
4. **Price changes** — alerts when saved vehicle prices change.
5. Remove individual saves or clear all saved vehicles.

Saving from inventory works on the public site; full sync across devices requires an account.

### Other public pages

| Page | URL | Purpose |
|------|-----|---------|
| Home | `/` | Featured vehicles and search |
| Buy | `/buy` | Buying guide and inquiry |
| Sell | `/sell` | Trade-in / sell appraisal form |
| Financing | `/financing` | Finance application |
| Contact | `/contact` | General contact form |
| About | `/about` | Dealership information |

Forms on these pages create leads the team sees in their admin **Leads** section. Linking to your account email helps pre-orders and inquiries appear together in `/account`.

---

## My Account

**URL:** `/account`

The account page has three main areas: **Pre-orders**, **Other inquiries**, and **Messages**.

### Your pre-orders

1. Sign in → `/account`
2. Scroll to **Your pre-orders**
3. Each card shows vehicle, date, and payment status:

| Status shown | Meaning |
|--------------|---------|
| Awaiting 25% deposit | Submitted; deposit not yet confirmed by team |
| 25% paid | Down payment confirmed |
| Paid in full | Full payment recorded |
| Cancelled | Pre-order cancelled |

4. Click **Message about this pre-order** to open a support ticket linked to that vehicle.

### Other inquiries

Shows contact, vehicle interest, and financing submissions tied to your account email.

### Messages (support tickets)

**URL:** `/account` (Messages section) · `/account?conversation=[id]`

This is a threaded chat with the dealership — not WhatsApp. A team member will claim your ticket and reply here.

**Start a new conversation**

1. On `/account`, click **New message** (or similar compose control).
2. Choose a **Category**:
   - General
   - Pre-order
   - Financing
   - Processing
3. Enter **Subject** and your message.
4. Submit — your ticket enters the team queue.

**Continue a conversation**

1. Select a thread from the left list.
2. Read agent replies.
3. Type in the reply box and send.

**Closed tickets**

When an agent closes your ticket:

- The thread shows as closed.
- To get help again, send a new message in that thread — this **reopens** the ticket and returns it to the team queue.
- You may see: *"Ticket reopened. Our team will pick it up from the queue."*

**Linked pre-orders**

Tickets started from a pre-order card include the vehicle context so agents see which car you mean.

---

## Common workflows

### Pre-order and follow up

1. Find a vehicle on `/inventory`
2. Pre-order from the detail page
3. Coordinate 25% deposit with the team (phone, WhatsApp, or in-person)
4. Check `/account` for payment status updates
5. Message the team from **Messages** if you have questions

### Ask about financing

1. Submit `/financing` form **or** start a Messages ticket with category **Financing**
2. Wait for an agent to claim your ticket
3. Reply in the thread until your question is resolved

### Save cars and compare later

1. Sign in
2. Heart vehicles while browsing `/inventory`
3. Open `/garage` → **Saved** tab
4. Watch **Price changes** for deals

### Register after a guest pre-order

If you pre-ordered as a guest using the same email you later register with, previous pre-orders link to your account automatically on sign-in.

---

## URLs quick reference

| Action | URL |
|--------|-----|
| Home | `/` |
| Inventory | `/inventory` |
| Vehicle page | `/inventory/[slug]` |
| Register | `/register` |
| Sign in | `/login` |
| My account | `/account` |
| My garage | `/garage` |
| Contact | `/contact` |
| Financing | `/financing` |

---

## Tips & limitations

- **Password:** Use at least 8 characters. Reset via login page if your project has email recovery enabled in Supabase.
- **Registration ID:** After sign-in you may see an ID like `TGA-…` — quote this when calling the dealership.
- **Payment:** The website records pre-order intent and status; actual payment is handled offline with True Goshen Auto staff.
- **Response times:** Messages are answered when a team member claims your ticket — not instant unless staff are online.
- **Privacy:** Only you and dealership staff can read your account messages.
- **No admin access:** Customer login is separate from staff login at `/admin`.

### Public visitors without an account

See [README — Public visitors](./README.md#public-visitors-no-account) for what you can do before registering.

---

## Need help?

- **On the website:** `/contact` or WhatsApp button
- **In your account:** `/account` → **Messages** → New message
- **By phone:** Number shown in the site footer and contact page
