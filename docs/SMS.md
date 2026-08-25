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

Customer **and** platform-team SMS attempts are written to `notification_log`
with `channel = sms` — `sent` rows carry the Arkesel message id, `failed` and
`skipped` rows carry the provider's reason.

## Reading the Arkesel response

Arkesel v2 answers a successful call with `status: "success"` and a `data`
**array** of per-recipient entries:

```json
{ "status": "success", "data": [{ "recipient": "233…", "id": "9b752841-…" }] }
```

Recipients the gateway refuses come back inside the same 200 response as
`{ "invalid numbers": ["…"] }`. `sendArkeselSms` treats that as a failure — a
2xx alone does not mean the message left the gateway.

Documented error statuses: `401` auth failed, `402` insufficient balance, `403`
inactive gateway (also raised for an unapproved sender ID), `422` validation,
`500` internal.

## What to paste

1. Create an Arkesel account and generate an API key.
2. Register/approve a sender ID in the Arkesel dashboard (max 11 characters).
   An unapproved sender ID fails with `403 Inactive Gateway`.
3. Top up SMS credit — an empty balance fails with `402`.
4. In Vercel (Production): set `ARKESEL_API_KEY`, `ARKESEL_SENDER_ID`, and
   `SMS_PROVIDER=arkesel`.
5. Or paste the same values under Platform → Settings → SMS (Arkesel).

## Troubleshooting "sent but never arrived"

1. Open Platform → Notifications and find the `channel = sms` row. A `failed`
   or `skipped` row carries the exact provider reason.
2. No row at all means the send path was never reached — check that the user
   has a phone number and that `smsConfig.ready` is true on Platform → Users.
3. A `sent` row with a message id means Arkesel accepted it; check the Arkesel
   dashboard SMS history for the final network status.
