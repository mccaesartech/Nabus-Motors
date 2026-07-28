# WhatsApp Cloud API (production)

> **Primary customer messaging is now SMS via Arkesel.** See [SMS.md](./SMS.md).
> WhatsApp remains available but dormant when `SMS_PROVIDER=arkesel` (or when
> Arkesel is configured and WhatsApp is not).

Outbound WhatsApp goes through `src/lib/notifications/whatsapp-send.ts`
(`sendWhatsAppMessage`). Do not call Meta/Twilio/Termii from feature routes.

## Environment variables

| Variable | Required | Notes |
| --- | --- | --- |
| `WHATSAPP_ENABLED` | Optional | Kill-switch (`true`/`false`). Overrides `whatsapp_enabled` site setting. |
| `WHATSAPP_PROVIDER` | Optional | `meta` (recommended), `twilio`, or `termii`. Auto-detects if unset. |
| `WHATSAPP_ACCESS_TOKEN` | Meta | Permanent system user token. |
| `WHATSAPP_PHONE_NUMBER_ID` | Meta | From Meta Business / WhatsApp → API Setup. |
| `WHATSAPP_BUSINESS_ACCOUNT_ID` | Optional | WABA ID (also storable in settings). |
| `WHATSAPP_VERIFY_TOKEN` | Webhook | **Env-only.** Must match Meta webhook verify token. |
| `WHATSAPP_APP_SECRET` | Webhook | **Env-only.** App secret for `X-Hub-Signature-256`. |
| `WHATSAPP_GRAPH_VERSION` | Optional | Default `v21.0`. |
| `TWILIO_ACCOUNT_SID` / `TWILIO_AUTH_TOKEN` / `TWILIO_WHATSAPP_FROM` | Twilio | Kept for fallback. |
| `TERMII_*` | Termii | Kept for Ghana SMS/WhatsApp fallback. |
| `CRON_SECRET` | Retry cron | Bearer / `x-cron-secret` for `/api/cron/whatsapp-retry`. |

Platform → Settings → **WhatsApp API** can store non-env credentials and Meta
template names. Env credentials always win when present. Access tokens in the
UI are masked on read.

## Webhook

URL (production):

```text
https://truegoshen.vercel.app/api/whatsapp/webhook
```

Route path: `/api/whatsapp/webhook` (same on custom domains such as
`truegoshen.com` / `truegoshenauto.com` if pointed at this Vercel project).

In Meta Developer → WhatsApp → Configuration:

1. Callback URL = the production URL above
2. Verify token = value of `WHATSAPP_VERIFY_TOKEN` in Vercel (Production)
3. Subscribe to **messages** (delivery statuses)
4. App secret from Meta App → Settings → Basic → **App Secret** → set as
   `WHATSAPP_APP_SECRET` in Vercel (env-only; never store in Platform Settings)

The route verifies GET challenges and POST HMAC signatures, records
`whatsapp_webhook_events` for replay protection, and updates
`notification_log` statuses (`sent` / `delivered` / `read` / `failed` /
`undeliverable`).

## Meta message templates

Approve templates in Meta Business Manager before production use. Default names
(overridable in Settings):

- `password_reset`
- `team_invite`
- `team_welcome`
- `team_role_changed`
- `team_password_set`

Language defaults to `en` (`whatsapp_template_language`). Outside the 24-hour
customer-care window, Meta requires approved templates — password reset and
team lifecycle messages prefer templates when the provider is Meta.

## Retry cron

`/api/cron/whatsapp-retry` is scheduled in `vercel.json`. On Vercel Hobby the
job runs once daily (`45 3 * * *` UTC) because Hobby forbids sub-daily crons.
For ~10-minute retries, either upgrade to Pro and restore `*/10 * * * *`, or
hit the endpoint from an external scheduler with `Authorization: Bearer
$CRON_SECRET` (or `x-cron-secret`). Failed retriable sends back off
(1m → 5m → 15m → 60m → 180m) up to 5 attempts, then `undeliverable`
(surfaced in the admin notification feed).

## Apply migration

Run `077_whatsapp_delivery_tracking.sql` on each Supabase environment before
relying on delivery columns / webhook event storage.

Production project (from existing storage URLs): `ddrknhvkhmgdtavpuiiq`

1. Open Supabase Dashboard → project → **SQL Editor**
2. Paste and run the full contents of
   `supabase/migrations/077_whatsapp_delivery_tracking.sql`
3. Confirm `whatsapp_webhook_events` exists and `notification_log` has
   `provider_message_id` / `idempotency_key` columns

CLI alternative (requires `supabase login` + linked project):

```bash
npx supabase db push
```

Supabase MCP was unavailable during go-live wiring (auth/channel failure), so
confirm this migration manually if it was not already applied.
