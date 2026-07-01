# True Goshen Auto — Role Guides

Step-by-step documentation for every user type on the True Goshen Auto platform. Each guide explains what that role can do, how to log in, and how to use every feature available to them.

## Platform roles (internal team)

| Role | Guide | Login |
|------|-------|-------|
| **Owner** | [owner.md](./owner.md) | Master password at `/admin` (leave email blank) |
| **Super Admin** | [super-admin.md](./super-admin.md) | Email + password at `/admin` |
| **Manager** | [manager.md](./manager.md) | Email + password at `/admin` |
| **Staff** | [staff.md](./staff.md) | Email + password at `/admin` |

## Public roles (website)

| Role | Guide | Login |
|------|-------|-------|
| **Customer** | [customer.md](./customer.md) | Register or sign in at `/register` or `/login` |
| **Public visitor** | See [Public visitors](#public-visitors-no-account) below | No account required |

---

## Quick permission comparison

| Area | Owner | Super Admin | Manager | Staff |
|------|:-----:|:-----------:|:-------:|:-----:|
| Dashboard | ✓ | ✓ | ✓ | ✓ |
| Inventory | ✓ | ✓ | ✓ | ✓ |
| Leads | ✓ | ✓ | ✓ | ✓ |
| Customer messages (support tickets) | ✓ | ✓ | ✓ | ✓ |
| Team chat | ✓ | ✓ | ✓ | ✓ |
| Customers | ✓ | ✓ | ✓ | — |
| Sales | ✓ | ✓ | ✓ | — |
| Documents | ✓ | ✓ | ✓ | — |
| Site content (CMS) | ✓ | ✓ | ✓ | — |
| Finance | ✓ | ✓ | — | — |
| Reports | ✓ | ✓ | — | — |
| Users & invites | ✓ | ✓ | — | — |
| Settings | ✓ | ✓ | — | — |
| Activity log | ✓ | ✓ | — | — |

**Available to all platform roles:** global search, notifications, currency selector (top bar).

Permissions are enforced in the app — if you open a URL you cannot access, you are redirected to the dashboard.

---

## Key URLs

### Admin portal (team)

| Page | Path |
|------|------|
| Sign in | `/admin` |
| Dashboard | `/platform/dashboard` |
| Inventory | `/platform/inventory` |
| Customers | `/platform/customers` |
| Sales | `/platform/sales` |
| Finance | `/platform/finance` |
| Leads | `/platform/leads` |
| Support tickets (messages) | `/platform/messages` |
| Team chat | `/platform/team-chat` |
| Documents | `/platform/documents` |
| Reports | `/platform/reports` |
| Users | `/platform/users` |
| Activity log | `/platform/users/activity` |
| Site content | `/platform/site-content` |
| Settings | `/platform/settings` |
| Notifications | `/platform/notifications` |
| Search | `/platform/search` |
| Accept invite | `/platform/invite/[token]` |

The admin login URL is not linked from the public website. It is also blocked in `robots.txt`.

### Public website

| Page | Path |
|------|------|
| Home | `/` |
| Inventory | `/inventory` |
| Vehicle detail | `/inventory/[slug]` |
| Buy | `/buy` |
| Sell / trade-in | `/sell` |
| Financing | `/financing` |
| Contact | `/contact` |
| About | `/about` |
| Register | `/register` |
| Sign in | `/login` |
| My account | `/account` |
| My garage (saved vehicles) | `/garage` |
| Terms | `/terms` |
| Privacy | `/privacy` |

---

## Public visitors (no account)

Visitors without an account can:

- Browse the full inventory at `/inventory` and open any vehicle detail page
- Switch display currency using the site currency selector
- Submit contact, buy, sell, and financing forms
- Start a pre-order from a vehicle page (guest flow can create an account during checkout)
- Use WhatsApp and other contact options on the site
- Save vehicles locally in the browser (full garage sync requires sign-in)

Visitors **cannot**:

- Track pre-orders or inquiries in `/account`
- Message the team through the in-app support ticket system (requires a registered account)
- Sync saved vehicles across devices in My Garage

See [customer.md](./customer.md) for everything available after registration.

---

## Common workflows (by role)

| Workflow | Best role |
|----------|-----------|
| Invite a team member | Owner or Super Admin → [Users](./owner.md#users--team-invites) |
| Add or edit a vehicle | Any role with Inventory access |
| Handle a pre-order lead | Manager+ (full pipeline) or Staff (view/update in Leads) |
| Claim a support ticket | Staff, Manager, Owner, or Super Admin → [Messages](./staff.md#support-tickets-customer-messages) |
| Convert pre-order to sale | Manager, Owner, or Super Admin → [Sales](./manager.md#sales) |
| Edit homepage copy | Manager, Owner, or Super Admin → [Site content](./manager.md#site-content-cms) |
| Export business data | Owner or Super Admin → [Reports](./owner.md#reports) |

---

## Related documentation

- [PLATFORM.md](../../PLATFORM.md) — deployment, Supabase, and environment variables
- [SUPABASE-SETUP.md](../../SUPABASE-SETUP.md) — database setup
