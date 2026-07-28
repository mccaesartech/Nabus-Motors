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
| Production | Production variables | Dedicated production project | Production | `https://truegoshen.vercel.app` |

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

## Incident closure

After recovery, preserve logs and deployment IDs, document customer impact,
rotate credentials only when authorized, verify alerts, and create corrective
actions with owners and dates. Do not declare backup or rollback readiness
without a timed restore/rollback exercise.
