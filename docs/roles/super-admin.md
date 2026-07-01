# Super Admin Guide

The **Super Admin** is a trusted team member with the same platform permissions as the Owner, but signs in with a personal email and password like other staff. Super Admins are invited by the Owner (or another Super Admin with user-management access).

---

## Role overview

- **Who:** Senior administrator, operations lead, or delegated owner
- **Access level:** Full — same permissions as Owner in the application
- **Login URL:** `/admin`
- **How to sign in:**
  1. Open `/admin`
  2. Enter your **work email**
  3. Enter your **password**
  4. Click **Sign In**

**First-time setup:** Use the invite link from `/platform/invite/[token]` to set your password before signing in.

---

## Permissions summary

### You CAN

Everything the Owner can do inside the platform:

| Area | Access |
|------|--------|
| Dashboard | ✓ |
| Inventory (add, edit, delete, AI Editor) | ✓ |
| Leads & pre-order detail | ✓ |
| Customers | ✓ |
| Sales | ✓ |
| Finance | ✓ |
| Support tickets (messages) | ✓ |
| Team chat (All Staff, groups, direct) | ✓ |
| Documents | ✓ |
| Reports (CSV export) | ✓ |
| Users & invites | ✓ |
| Site content (CMS) | ✓ |
| Settings | ✓ |
| Activity log | ✓ |
| Notifications & search | ✓ |

### You CANNOT

- Sign in with the Owner master password (unless you also know it — use your own account instead)
- Remove or disable the Owner (Owner is not in the Users list)
- Change `ADMIN_PASSWORD` from the app (server environment only)

---

## How Super Admin differs from Owner

| | Owner | Super Admin |
|---|-------|-------------|
| Login | Blank email + master password | Email + password |
| Listed in Users page | No | Yes |
| Can be disabled/removed | N/A | Yes, by another Super Admin or Owner |
| App permissions | Full | Full (identical) |
| Appears in team chat as | "Owner" | "Super Admin" |
| Customer tickets assigned to you | Shows as Owner | Shows your name and role |

For day-to-day platform use, follow the [Owner guide](./owner.md) — every feature section applies to you.

---

## Platform features (step-by-step)

Use the same URLs and steps as the Owner guide. Quick reference:

| Feature | URL |
|---------|-----|
| Dashboard | `/platform/dashboard` |
| Inventory | `/platform/inventory` |
| Add vehicle | `/platform/inventory/new` |
| Leads | `/platform/leads` |
| Pre-order detail | `/platform/leads/preorder/[id]` |
| Customers | `/platform/customers` |
| Sales | `/platform/sales` |
| Finance | `/platform/finance` |
| Support tickets | `/platform/messages` |
| Team chat | `/platform/team-chat` |
| Documents | `/platform/documents` |
| Reports | `/platform/reports` |
| Users | `/platform/users` |
| Activity log | `/platform/users/activity` |
| Site content | `/platform/site-content` |
| Settings | `/platform/settings` |
| Notifications | `/platform/notifications` |
| Search | `/platform/search` |

Detailed walkthroughs: [owner.md](./owner.md)

---

## Users & team invites (Super Admin responsibilities)

As a Super Admin you typically help the Owner manage the team.

### Invite a team member

1. Go to `/platform/users`
2. Enter name, email, and role: **Super Admin**, **Manager**, or **Staff**
3. Click **Send invite**
4. Copy the invite link if automatic email is not configured

### Manage users

- Change roles via the dropdown on each row
- Resend invites to pending users
- Remove users who have left the company

### View activity

Open `/platform/users/activity` to audit sign-ins, inventory edits, lead changes, and exports.

---

## Support tickets

Same workflow as all message-enabled roles:

1. **Open queue** — unclaimed tickets waiting for an agent
2. **Accept ticket** — assigns the conversation to you
3. Reply — use **Draft with AI** if Gemini is configured
4. **Close ticket** — optional resolution note
5. **New conversation** — proactively message any customer with an email on file

When customers reopen closed tickets, they return to the open queue.

---

## Team chat

- **All Staff:** company-wide channel — all team members can read and post
- **Groups:** you can create and manage groups (same as Manager and Owner)
- **Direct:** message any colleague or the Owner one-to-one

---

## Common workflows

### Onboard a new Manager

1. `/platform/users` → invite with role **Manager**
2. Share invite link → they set password at `/platform/invite/[token]`
3. Confirm they see Inventory, Leads, Messages, Customers, Sales, Documents, Site Content

### End-of-month reporting

1. `/platform/reports` → set date range → export Leads, Pre-orders, and Sales CSVs
2. `/platform/finance` → review revenue vs expenses → export expenses

### Website copy update

1. `/platform/site-content` → pick section tab → edit → **Save**
2. Preview on the public site

---

## Tips & limitations

- **Password reset:** Ask another Super Admin or the Owner to resend your invite link, or use your email provider if Supabase/auth recovery is enabled for platform users.
- **Do not share your login** — each person should have their own account for the activity log to be accurate.
- **Owner sessions:** If the Owner is also logged in on another device with the master password, you both have full access independently.
- **AI assist:** Requires `GEMINI_API_KEY` on the server; manual replies always work without it.

See also: [README — permission comparison](./README.md#quick-permission-comparison)
