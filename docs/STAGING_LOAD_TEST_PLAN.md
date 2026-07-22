# Staging load and concurrency test plan

This plan is for an isolated non-production environment only. The repository
does not define expected traffic, concurrency, or user-facing latency SLOs.
Product and operations owners must approve those targets before results can be
used as a release capacity claim.

## Local smoke

Start a local production build and run:

```powershell
npm run load:smoke
```

Defaults are deliberately small: two virtual users, two iterations, four
read-only scenarios, five-second request timeout, and localhost only. Optional
unauthenticated denial probes exercise listing creation, customer messaging,
and upload authorization without writing data:

```powershell
$env:LOAD_ENABLE_NEGATIVE_AUTH_PROBES="true"
npm run load:smoke
```

The script refuses known production hostnames. A non-loopback target requires
both `LOAD_ALLOW_STAGING=true` and `LOAD_CONFIRM_NONPROD` equal to the exact
target origin.

Local timings prove only that the scenario works. They are not capacity
evidence and should not be compared with production SLOs.

## Required staging prerequisites

- Dedicated staging Vercel deployment and dedicated Supabase project.
- Synthetic data only; no copied production PII.
- Applied migrations, including security migration 073 and validated index
  migration 074.
- Disposable admin, assigned-role, and customer test accounts.
- Provider email/SMS/WhatsApp delivery disabled or routed to provider sandboxes.
- Dedicated storage bucket/prefix for the test run.
- A unique run ID such as `phase6-YYYYMMDD-HHMM`.
- Dashboard access for Vercel errors/duration/concurrency and Supabase
  database/PostgREST/storage/auth quotas.
- Approved expected concurrency, request mix, p95 latency, and error-rate SLOs.

## Proposed ramp for owner approval

This is a conservative starting plan, not an approved target:

1. Warm-up: 1 virtual user for 1 minute.
2. Baseline: 5 virtual users for 3 minutes.
3. Ramp: 5 to 15 virtual users over 3 minutes.
4. Hold: 15 virtual users for 5 minutes.
5. Recovery: 1 virtual user for 2 minutes.

Stop immediately if any provider dashboard reaches 70% of a documented quota,
5xx responses exceed 2% for one minute, p95 exceeds the approved SLO for two
consecutive windows, authentication/provider sandbox traffic escapes the test
accounts, or cleanup fails.

## Scenario mix

Use a k6 or Artillery implementation approved by operations:

- 45% browse home, inventory pages, vehicle details, and facets.
- 20% search/filter with bounded terms and pagination.
- 10% create a synthetic listing, edit one field, then soft-delete it.
- 10% customer sends a synthetic support/seller message and assigned staff
  reads/replies.
- 5% upload one small valid JPEG/WebP under the run-specific storage prefix,
  attach it to the synthetic listing, remove the reference, and delete the
  object.
- 10% authentication/session, health, denied Settings access, and rate-limit
  behavior.

Do not send real email/SMS/WhatsApp or invoke AI/provider calls. Stub them or
use provider sandbox modes.

## Data isolation and cleanup

Tag every created row with the unique run ID in a supported text field. Before
the run, record the staging row/object baseline. After the run:

1. Soft-delete synthetic vehicles through the application route.
2. Delete run-specific storage objects using an authorized staging cleanup
   procedure.
3. Remove synthetic conversations/messages and account-lifecycle records using
   a reviewed staging-only cleanup script or reset the disposable database.
4. Delete disposable Auth users.
5. Verify row counts, storage object counts, cron queues, and notification
   tables returned to baseline.

Do not point cleanup tooling at production. The run is invalid if cleanup
cannot be proven.

## Thresholds and evidence

Owners must replace placeholders before execution:

- Browse/search p95: `Needs owner decision`
- Auth/write p95: `Needs owner decision`
- Overall error rate: suggested initial ceiling `< 1%`, requires approval
- 5xx rate: suggested abort ceiling `> 2% for 1 minute`, requires approval
- Maximum database connections/pool utilization: `Needs provider evidence`
- Maximum storage/provider calls: `Needs provider evidence`

Archive the scenario version, commit SHA, exact target, environment declaration,
synthetic fixture IDs, ramp, request counts, p50/p95/p99, status distribution,
timeouts, provider graphs, quota deltas, cleanup proof, and owner sign-off.
