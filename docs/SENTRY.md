# Sentry error monitoring

True Goshen Auto uses [`@sentry/nextjs`](https://docs.sentry.io/platforms/javascript/guides/nextjs/)
for production error tracking. The SDK is **gated by DSN**: if no DSN is set,
Sentry does nothing and the app behaves as before (structured `next_request_error`
logs in Vercel still work).

## What is already in the repo

| File | Role |
| --- | --- |
| `src/instrumentation-client.ts` | Browser / client SDK init |
| `src/sentry.server.config.ts` | Node.js server SDK init |
| `src/sentry.edge.config.ts` | Edge runtime SDK init |
| `src/instrumentation.ts` | Loads server/edge configs; captures request errors |
| `src/app/global-error.tsx` | Reports App Router render failures |
| `src/lib/observability/schema-issue.ts` | Server-side schema/migration warnings → Sentry |

Optional source-map upload (readable stack traces) is **not** required for
basic error capture. Add `SENTRY_AUTH_TOKEN` + org/project later if you want it.

## Schema / migration warnings (ops, not admin UI)

When PostgREST reports a missing column (e.g. `platform_users.deleted_at`) the
API falls back silently for the admin UI and calls `reportSchemaIssue()` which:

1. Writes a structured `schema_issue` log line (always).
2. Calls `Sentry.captureMessage(..., "warning")` **only when a DSN is set**.

Owners should never see migration file names or SQL in Platform banners for these
gaps. Fix the database (or reload the schema cache), and watch Sentry Issues for
tags `schema_issue=true`.

## Step-by-step: get a DSN from sentry.io

1. Open [https://sentry.io/signup/](https://sentry.io/signup/) and create a free
   account (or sign in).
2. Create (or select) an **organization**.
3. Create a new project:
   - Platform: **Next.js**
   - Name suggestion: `true-goshen-auto` (or similar)
4. Skip the wizard install steps in the Sentry UI if you prefer — this repo is
   already wired. You only need the **DSN**.
5. Copy the DSN from **Project Settings → Client Keys (DSN)**. It looks like:
   `https://xxxx@oNNNN.ingest.sentry.io/MMMM`

## Vercel environment variables

In the Vercel project → **Settings → Environment Variables**, add for
**Production** (and Preview if you want preview errors too):

| Variable | Required | Notes |
| --- | --- | --- |
| `NEXT_PUBLIC_SENTRY_DSN` | Yes (for browser + shared) | Same DSN string from Sentry |
| `SENTRY_DSN` | Recommended | Same DSN; used by server/edge (falls back to public DSN) |
| `SENTRY_ENVIRONMENT` | Optional | e.g. `production` (defaults to `VERCEL_ENV`) |
| `SENTRY_ORG` | Optional | Only if you later enable source-map upload |
| `SENTRY_PROJECT` | Optional | Only if you later enable source-map upload |
| `SENTRY_AUTH_TOKEN` | Optional | CI/build secret for source maps — never commit |

Use the **same DSN value** for both `NEXT_PUBLIC_SENTRY_DSN` and `SENTRY_DSN`.

Then **redeploy** Production so the new env vars are baked into the build
(`NEXT_PUBLIC_*` values are inlined at build time).

**Current production status:** as of the last check, neither `SENTRY_DSN` nor
`NEXT_PUBLIC_SENTRY_DSN` was present on the Vercel project. Until you add them
and redeploy, schema warnings only appear in Vercel function logs (not Sentry).

## Verify

1. After deploy, trigger a known error (temporary throw in a route, or a failing
   admin action you control).
2. Open Sentry → **Issues** and confirm the event appears (can take ~1 minute).
3. Confirm `environment` and `release` tags look right (Vercel env / git SHA).

Do **not** rely on `throw` from the browser console — those are sandboxed and
often never reach Sentry.

## Privacy

Configs use `sendDefaultPii: false`. Prefer scrubbing any custom
`captureException` payloads that might include emails, phones, or auth tokens.
Existing `next_request_error` console records stay sanitized (no URLs/headers/PII).

## Local development

Leave DSNs unset locally to keep Sentry off. To test against a Sentry project,
add both DSN vars to `.env.local` (do not commit that file).
