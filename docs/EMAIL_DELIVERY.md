# Email delivery (Resend)

All outbound product email goes through `sendEmail()` in
`src/lib/email/resend.ts`. It reads two environment variables and refuses to
send without them:

| Variable | Value |
| --- | --- |
| `RESEND_API_KEY` | `re_…` from https://resend.com/api-keys |
| `RESEND_FROM_EMAIL` | `noreply@truegoshengh.com` (or `True Goshen <noreply@truegoshengh.com>`) |

The address in `RESEND_FROM_EMAIL` is passed to Resend verbatim as the `from`
header. Resend decides whether it will deliver based on that domain.

## Why invites only reach one inbox

Resend applies a hard restriction to accounts with no verified domain:

> You can only send testing emails to your own email address (…). To send
> emails to other recipients, please verify a domain at resend.com/domains, and
> change the `from` address to an email using this domain.

This is enforced by Resend's API, not by this application. **No code change can
bypass it.** Until `truegoshengh.com` is verified, only the Resend account
owner's own address receives mail; every other recipient is rejected with the
message above.

While the domain is unverified the invite is still created and stored — the
owner can copy the invite link from Platform → Users and share it manually.

## Fix: verify truegoshengh.com

1. Sign in at https://resend.com with the account that owns `RESEND_API_KEY`.
2. Go to **Domains → Add Domain**, enter `truegoshengh.com`, and pick the
   region closest to your users.
3. Resend shows a set of DNS records. Add every one of them at your DNS host
   (wherever the nameservers for `truegoshengh.com` point — Vercel DNS,
   Cloudflare, Namecheap, etc.):
   - **DKIM** — a `TXT` record named `resend._domainkey` (Resend gives the
     exact host and value). This is the record that actually authorises Resend
     to sign mail as your domain.
   - **SPF** — a `TXT` record on the sending subdomain containing
     `v=spf1 include:amazonses.com ~all`, plus the `MX` record Resend lists for
     the same subdomain. If you already have an SPF record on that host, merge
     the `include:` into the existing record — never publish two SPF records.
   - **DMARC** (optional but recommended) — a `TXT` record at `_dmarc` such as
     `v=DMARC1; p=none; rua=mailto:dmarc@truegoshengh.com`. Start with
     `p=none`, tighten to `quarantine`/`reject` after you have seen reports.
   - **Custom Return-Path / MAIL FROM** (optional) — if Resend offers a
     `send.truegoshengh.com` subdomain, add its `MX` and `TXT` records too.
     This aligns the bounce domain with your brand and improves deliverability.
4. Copy each record exactly. Do not append the domain to the host if your DNS
   provider already does it (a common cause of
   `resend._domainkey.truegoshengh.com.truegoshengh.com`).
5. Click **Verify**. DNS usually propagates in 5–30 minutes; allow up to 48
   hours. Re-click **Verify** until the domain shows **Verified**.

## Then point the app at the verified domain

1. Vercel → your project → **Settings → Environment Variables**.
2. Set `RESEND_FROM_EMAIL=noreply@truegoshengh.com` for **Production**. Add the
   same value to **Preview** and **Development** if those environments send
   mail; otherwise leave them unset so they fail loudly instead of silently
   sending from the wrong domain.
3. Confirm `RESEND_API_KEY` is set for the same environments.
4. **Redeploy.** Environment variables are baked in at deploy time — editing
   them without redeploying changes nothing.
5. In Platform → Users, use **Resend email** on a pending user and confirm the
   toast reads "Invite emailed to …".

## When the domain is Verified but Resend still refuses

Resend answers `The truegoshengh.com domain is not verified` (a `403`
`validation_error`) whenever **the API key in the request cannot see a verified
copy of that domain** - not only when the domain is genuinely unverified. The
message quotes the domain from your own `from` header, so it reads identically
in all of these cases:

1. **The key belongs to a different Resend account.** Keys are scoped to the
   account that created them
   (<https://resend.com/docs/dashboard/api-keys/introduction>), so a domain
   verified in one account is invisible to a key from another.
2. **The key belongs to a different team inside the same account.** One login
   can hold several teams, and the Domains page shows only the team you are
   currently viewing.
3. **The key is not the one you think you pasted.** Vercel stores a *separate*
   value of `RESEND_API_KEY` per environment and freezes it into the build, so
   saving a new key to Preview leaves Production sending with its old key until
   you re-save Production *and* redeploy.

Region is **not** a cause. A domain's region (`eu-west-1`, `us-east-1`) only
decides where mail is dispatched from. Resend serves every region from the one
`api.resend.com` host, API keys are not region-bound, and multi-region works
"within the same account"
(<https://resend.com/docs/dashboard/domains/regions>). No `baseUrl` or region
option is needed in `src/lib/email/resend.ts`.

### Prove which key the deployment is using

`GET /api/admin/email-diagnostics` - admin session with the `settings`
permission - calls Resend's `GET /domains` using the key baked into the
*running* deployment and reports:

| Field | Meaning |
| --- | --- |
| `status` | `ok` only when the From domain is verified for this key |
| `apiKeyLast4` | last four characters of the deployed key, and never more |
| `domains[]` | every domain this key can see, with `status` and `region` |
| `fromDomainVerified` | whether `RESEND_FROM_EMAIL`'s domain is among them |
| `environment.vercelEnv` | which environment answered, so you know you hit Production |
| `verdict` / `nextAction` | the specific cause, and the one thing to do next |

`status: "from_domain_not_in_account"` alongside a populated `domains[]` that
omits `truegoshengh.com` is proof of cause 1 or 2. If `apiKeyLast4` does not
change after you save a new key and redeploy, the change never reached that
environment - cause 3.

A sending-only key returns `status: "key_restricted"` (Resend `401
restricted_api_key`), because listing domains requires **Full access**. Such a
key can still send; it simply cannot answer this question.

## Diagnosing failures

- Platform → Settings surfaces `getEmailDeliveryHealth()`, which warns when
  `RESEND_FROM_EMAIL` is missing, malformed, or still on Resend's shared
  `@resend.dev` testing sender.
- Platform → Emails runs failure text through `formatEmailFailureHint()`.
- Invite rows record `email_status`, `provider_message_id`, and
  `provider_error` (migration `089_invitation_email_delivery.sql`), so a failed
  send is auditable after the fact.
