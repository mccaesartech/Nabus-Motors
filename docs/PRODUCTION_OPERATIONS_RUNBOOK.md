# Production operations runbook

This runbook defines the repository-side deployment and recovery procedure. It
does not prove that any provider setting, backup, alert, or restore test exists.
Record dashboard evidence and the date/owner of every verification before
release. Never paste secret values into this document.

## Ownership and release authority

Assign named people to these roles in the private operations system:

- **Release owner:** approves production deploys and rollback.
- **Incident commander:** coordinates response and communications.
- **Application owner:** investigates Vercel functions, releases, and logs.
- **Database owner:** controls Supabase migrations, backups, and restore tests.
- **Security/privacy owner:** handles suspected compromise or PII exposure.

The release owner and database owner must approve the production RPO and RTO.
Record the approved values, date, and evidence location before launch:

- **RPO (maximum acceptable data loss):** `Needs owner decision`
- **RTO (maximum acceptable recovery time):** `Needs owner decision`

## Environment separation

Use separate Vercel environments and separate Supabase projects for
development, staging, and production. Do not share service-role keys, auth
users, storage buckets, provider API keys, or webhook credentials.

| Environment | Vercel | Supabase | Data | Public URL |
| --- | --- | --- | --- | --- |
| Development | Local or Development variables | Dedicated development project | Synthetic only | `http://localhost:3000` |
| Staging | Preview or dedicated staging project | Dedicated staging project | Synthetic/anonymized only | Explicit staging URL |
| Production | Production variables | Dedicated production project | Production | `https://www.truegoshengh.com` |

**Invite / public links:** Production `NEXT_PUBLIC_SITE_URL` must be `https://www.truegoshengh.com` and resolve in public DNS. Fix Namecheap DNS/DNSSEC before flipping env (see `LAUNCH_DOMAIN_CUTOVER.md`). Do not leave `PUBLIC_SITE_URL_EMERGENCY_FALLBACK` set for launch.

Verify these variable names independently in every environment:

- Supabase: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
  `SUPABASE_SERVICE_ROLE_KEY`
- Canonical URLs/auth: `NEXT_PUBLIC_SITE_URL`,
  `NEXT_PUBLIC_AUTO_SITE_URL`, `WEBAUTHN_RP_ID`
- Admin/cron: `ADMIN_PASSWORD`, `ADMIN_SECRET`, `CRON_SECRET`
- Email/messaging: `RESEND_API_KEY`, `RESEND_FROM_EMAIL`,
  `WHATSAPP_PROVIDER` and the selected provider's credentials
  (see `docs/WHATSAPP.md` for Meta webhook / template setup)
- Optional integrations: `GEMINI_API_KEY`,
  `NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME`, VAPID variables

For each environment, verify Supabase Authentication → URL Configuration and
provider sender domains. Never authorize a broad production wildcard for
untrusted preview domains.

## Pre-deployment gate

On a clean checkout with Node 20:

```bash
npm ci
npm run audit:prod
npm run check:migrations
npm test
npm run typecheck
npm run lint
npm run build
```

GitHub Actions runs the same gate. Configure branch protection so the `verify`
job is required. In Vercel, deploy production only from the protected production
branch after that check passes. The workflow does not deploy or hold provider
secrets.

Before deployment:

1. Confirm `ADMIN_SECRET` and `CRON_SECRET` are configured and distinct.
2. Confirm migration `073_security_hardening.sql` has been applied and tested.
3. Validate staged migration `074_phase4_query_indexes.sql` on staging with
   representative `EXPLAIN (ANALYZE, BUFFERS)` evidence before production.
4. Confirm no destructive migration is bundled with an application rollback
   that expects the removed schema.
5. Confirm distributed rate limiting is enabled for public/auth endpoints or
   explicitly accept the residual risk of process-local limits.

## Deployment and smoke checks

Vercel creates immutable deployments and a production alias. Record the
deployment URL, Git commit SHA, migration set, release owner, and timestamp.

After promotion:

1. `GET /api/health/live` must return `200` and the expected release.
2. `GET /api/health/ready` must return `200`. A `503` means required
   configuration or the database probe failed; it intentionally reveals no
   provider details.
3. Exercise customer sign-in, admin sign-in/logout, one read-only inventory
   page, and one synthetic non-production inquiry.
4. Confirm the account-deletion cron shows a successful invocation without
   exposing records in logs.
5. Confirm WhatsApp webhook verify works (`GET /api/whatsapp/webhook`) when
   Meta credentials are configured, and that `/api/cron/whatsapp-retry`
   accepts `CRON_SECRET`. See `docs/WHATSAPP.md`.
6. Confirm error and latency dashboards identify the new release.

## Rollback

Application rollback:

1. Stop further promotions.
2. In Vercel → Deployments, select the last verified deployment and use
   **Promote to Production**.
3. Verify `/api/health/live`, `/api/health/ready`, sign-in, and critical reads.
4. Record incident timeline and affected release IDs.

Database rollback is separate. Prefer forward fixes and expand/contract
migrations:

1. Add new nullable columns/tables first.
2. Deploy code that can read old and new shapes.
3. Backfill and verify.
4. Remove old schema only in a later release after the rollback window.

Never reverse a data migration blindly. Migration 074 includes explicit index
drop commands and still requires staging validation. For irreversible data
changes, restore into a new project and validate before cutover.

## Backup and restore validation

In Supabase production:

1. Project Settings → Database → Backups: capture retention, point-in-time
   recovery availability, encryption/provider evidence, and latest successful
   backup time.
2. At the approved test interval, restore into an isolated non-production
   project.
3. Use separate staging credentials; never point the public production alias at
   the restore during validation.
4. Apply pending migrations, run health checks, and validate row counts,
   foreign keys, RLS policies, storage references, auth configuration, and a
   sample of critical customer/admin flows.
5. Record restore start/end, recovered backup timestamp, achieved RPO/RTO,
   discrepancies, and owner sign-off.

Database backups do not automatically prove recovery of Supabase Storage,
Authentication settings/users, Vercel environment variables, DNS, or third-party
provider configuration. Export/configure recovery procedures for each according
to provider capabilities and access policy.

## Monitoring and alerts

Configure an uptime monitor:

- `/api/health/live`: every minute; alert after two consecutive failures.
- `/api/health/ready`: every minute; alert immediately on sustained `503`.
- Use `GET`, HTTPS, and no authentication; do not log response bodies as secrets.

Configure Vercel alerts for function 5xx rate, p95 duration, invocation
timeouts, cron failures, and unexpected traffic/cost. Configure Supabase alerts
for database/storage/auth quota, connection or PostgREST saturation, slow
queries, replication/backup failure, and nearing plan limits.

Configure DNS/certificate expiry and domain-resolution monitoring for every
production hostname. Route alerts to the incident commander with primary and
secondary escalation contacts.

The repository emits sanitized structured `next_request_error` records with
environment, release, runtime, route file, route type, method, and digest. It
does not include request URLs, headers, error messages, or PII. Sentry is wired
via `@sentry/nextjs` (client/server/edge) and activates only when
`SENTRY_DSN` / `NEXT_PUBLIC_SENTRY_DSN` are set — see [SENTRY.md](./SENTRY.md).
Optional authenticated source-map upload, PII scrubbing, and sampling rates are
documented there; do not expose auth tokens or private source maps.

## Capacity and load verification

Repository limits are not capacity evidence. Before launch, record:

- Vercel function duration/memory/concurrency and region settings.
- Supabase PostgREST/database pool limits and observed peak utilization.
- Storage/object limits and upload caps (current admin image paths cap files in
  application code; provider limits still apply).
- Cron duration and maximum rows processed per run.
- Load-test p50/p95/p99 latency and error rate using synthetic staging data.

Process-local rate limiting is not shared across serverless instances. Replace
it with an existing provider/distributed primitive before relying on it as a
production abuse ceiling.

## Vercel pause / `402 DEPLOYMENT_DISABLED`

### What it means

If production returns **HTTP 402** with `X-Vercel-Error: DEPLOYMENT_DISABLED`
(body often `Payment required` / `DEPLOYMENT_DISABLED`), Vercel has **disabled
serving** the deployment. This is **not** an application bug, DNS failure, or
bad build.

Common causes on team **mccaesartech** / project **truegoshenauto**:

- Hobby (or other) **usage limits** exceeded (Fluid CPU, provisioned memory,
  bandwidth, invocations, cron invocations) in the rolling usage window
- Missing / failed **payment method** or unpaid invoice on a paid plan
- Fair-use / ToS pause that requires support review

CLI may still list the latest production deployment as **Ready** and show the
correct aliases (`www.truegoshengh.com`, etc.). That only means the last build
exists — **edge serving is still disabled** until the account/team is unpaused.

**Do not redeploy while 402 is active.** A new deploy will not restore traffic
and can waste build minutes. Fix billing/usage first, confirm `200` on the
public host, then deploy only if a code change is needed.

Official reference: [DEPLOYMENT_DISABLED](https://vercel.com/docs/errors/deployment_disabled).

### Unpause now (dashboard — team mccaesartech)

Owner with billing access must do this in the browser (CLI cannot clear a
billing/usage pause):

1. Sign in at [vercel.com](https://vercel.com) as a member of team
   **McCaesar TEchnology Solutions** (`mccaesartech`).
2. Switch to that team in the top-left team switcher.
3. Open **Settings → Billing** (team billing):
   [vercel.com/mccaesartech/~/settings/billing](https://vercel.com/mccaesartech/~/settings/billing)
4. Resolve the pause:
   - **Payment / invoice:** add a valid payment method, pay any open invoice,
     confirm the card is not expired/declined.
   - **Hobby usage pause:** open **Usage** for the team, note which meter is
     over limit. Fastest restore is usually **Upgrade to Pro** (pay-as-you-go
     overages). Staying on Hobby may require waiting until the rolling window
     drops below limits **and** requesting unpause via
     [vercel.com/help](https://vercel.com/help) if it does not auto-resume.
   - **Banner “Paused — Upgrade to resume”:** follow the upgrade CTA or the
     email Vercel sent about the pause.
5. Confirm restore (no redeploy yet):
   ```powershell
   curl.exe -sI "https://www.truegoshengh.com"
   ```
   Expect `HTTP/1.1 200` (or a normal app redirect), **not** `402` /
   `DEPLOYMENT_DISABLED`. Also check `/api/health/live` and `/api/health/ready`.
6. Redeploy **only if** you still need a new release after serving is back.

If billing looks fine and the site remains 402, contact Vercel support from
[vercel.com/help](https://vercel.com/help) with team slug `mccaesartech`,
project `truegoshenauto`, and a sample `X-Vercel-Id` from the 402 response.

### Prevention checklist (do not skip)

| Control | Action |
| --- | --- |
| Payment method | Keep a valid card on the team that owns production; set invoice/receipt email to an monitored inbox. |
| Usage alerts | In Vercel → team **Usage** / billing alerts, notify before hitting Fluid CPU, memory, bandwidth, and function/cron invocation thresholds. |
| Plan fit | Production customer traffic on **Hobby** is risky (hard pauses). Prefer **Pro** for `truegoshenauto` / `www.truegoshengh.com`. |
| Cron inventory | Keep `vercel.json` cron count and frequency low. Current jobs: `account-deletion-cleanup` (`0 3 * * *`), `correct-vehicle-colors` (`15 4 * * *`), `whatsapp-retry` (`45 3 * * *`). Avoid sub-hourly crons; move heavy work off Vercel Functions when possible. |
| Multi-project load | Team pause affects **all** projects under `mccaesartech`. Monitor aggregate usage across every production site on the team, not only True Goshen. |
| Uptime monitors | Alert on **402** / `DEPLOYMENT_DISABLED` as well as 5xx — treat as a billing/ops incident, not an app deploy. |
| After near-miss | Document which meter tripped, owner, and corrective action (upgrade, cron trim, or workload move). |

## Incident closure

After recovery, preserve logs and deployment IDs, document customer impact,
rotate credentials only when authorized, verify alerts, and create corrective
actions with owners and dates. Do not declare backup or rollback readiness
without a timed restore/rollback exercise.
