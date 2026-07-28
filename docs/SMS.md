# SMS via Arkesel (primary)

Outbound SMS goes through `src/lib/notifications/arkesel.ts`
(`sendArkeselSms`). Customer, admin, and team notify helpers prefer Arkesel
when it is selected or when WhatsApp is not configured.

WhatsApp code remains in the repo (dormant / configurable) — see
[WHATSAPP.md](./WHATSAPP.md).

## Environment variables

| Variable | Required | Notes |
| --- | --- | --- |
| `SMS_PROVIDER` | Recommended | Set to `arkesel` to prefer SMS over WhatsApp. |
| `NOTIFICATION_PROVIDER` | Optional | Also accepts `arkesel` (same preference). |
| `ARKESEL_API_KEY` | Yes | From the Arkesel dashboard. Prefer Vercel env over UI. |
| `ARKESEL_SENDER_ID` | Yes | Approved sender ID (max 11 characters). Alias: `ARKESEL_SENDER`. |
| `ARKESEL_BASE_URL` | Optional | Default `https://sms.arkesel.com`. |
| `ARKESEL_ENABLED` | Optional | Kill-switch (`true`/`false`). Overrides `arkesel_enabled` site setting. |

Platform → Settings → **SMS (Arkesel)** can store the API key (masked), sender
ID, base URL, and enable toggle when env vars are not set. Env credentials
always win when present.

## API shape

`POST https://sms.arkesel.com/api/v2/sms/send`

- Header: `api-key: <ARKESEL_API_KEY>`
- JSON body: `{ "sender", "message", "recipients": ["233…"] }`

Phone numbers are normalized with Ghana helpers in
`src/lib/notifications/phone.ts` (digits only, country code `233`).

## Behaviour

1. When `SMS_PROVIDER=arkesel` (or `NOTIFICATION_PROVIDER=arkesel`) **and**
   credentials are ready → SMS is primary; WhatsApp is skipped.
2. When Arkesel is ready and WhatsApp is not configured / disabled → SMS is
   primary.
3. Otherwise WhatsApp runs first; Arkesel (then Termii) is used as SMS
   fallback on opt-out, deferral, or failure.
4. SMS failures never block business flows — they are logged and ignored.

Successful SMS rows are written to `notification_log` with `channel = sms`.

## What to paste

1. Create an Arkesel account and generate an API key.
2. Register/approve a sender ID in the Arkesel dashboard.
3. In Vercel (Production): set `ARKESEL_API_KEY`, `ARKESEL_SENDER_ID`, and
   `SMS_PROVIDER=arkesel`.
4. Or paste the same values under Platform → Settings → SMS (Arkesel).
