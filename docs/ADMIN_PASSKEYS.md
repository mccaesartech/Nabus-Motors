# Admin passkeys (WebAuthn / FIDO2)

True Goshen admin authentication uses a **custom session model** (not Supabase Auth). Team members sign in at `/admin` with email + password and receive a signed `tg_platform_session` cookie. Passkeys add an optional, passwordless sign-in path for those same platform users.

The bootstrap **owner** account (master `ADMIN_PASSWORD`, no email) does **not** support passkeys. Owner login continues to use the env password only.

## Prerequisites

1. Run migration `072_admin_passkeys.sql` in Supabase SQL Editor (or via your migration pipeline).
2. Set environment variables (see below).
3. Deploy with `@simplewebauthn/server` and `@simplewebauthn/browser` installed.

## Environment variables

| Variable | Example | Purpose |
|----------|---------|---------|
| `WEBAUTHN_RP_ID` | `www.truegoshengh.com` | Relying Party ID — must match the site hostname users visit |
| `WEBAUTHN_RP_NAME` | `True Goshen Admin` | Human-readable name shown in passkey prompts |
| `NEXT_PUBLIC_WEBAUTHN_ENABLED` | `true` | Feature flag for login UI and settings |

`WEBAUTHN_RP_ID` defaults to the hostname of `NEXT_PUBLIC_SITE_URL` if unset.

For local development, use `localhost` as RP ID and `http://localhost:3000` as origin. Chrome and Safari support passkeys on localhost.

## Setup flow

1. Sign in as a team member with email + password.
2. Open **Platform → Settings → Security**.
3. Click **Add passkey** and complete the browser / device prompt.
4. Optionally click **Generate backup codes** and store the file securely (shown once).

## Sign-in options

| Method | Who | Notes |
|--------|-----|-------|
| Password | Owner (no email) or team (email + password) | Unchanged |
| Passkey | Team accounts with registered passkeys | Requires email on login page |
| Backup code | Team accounts with generated codes | One-time use; link on login page |

## Recovery

- **Lost passkey device:** Use a backup recovery code on the login page, or sign in with password.
- **Lost password:** Another admin can disable the account and re-invite, or you use backup codes if password reset is not available.
- **Lost everything:** Owner uses `ADMIN_PASSWORD`; owner can manage users from **Users & roles**.

Regenerating backup codes invalidates all previous unused codes.

## Security notes

- WebAuthn challenges expire after **5 minutes**.
- Origin and RP ID are verified on every registration and authentication.
- Authenticator **counter** values are stored and checked for replay.
- Passkey login sets the same httpOnly `tg_platform_session` cookie as password login.
- Passkey endpoints are rate-limited (10 attempts per IP per minute).

## Mobile & PWA

- **iOS Safari:** Passkeys sync via iCloud Keychain when using a synced passkey.
- **Android Chrome:** Google Password Manager can store passkeys.
- **Installed admin PWA:** Passkeys work when the PWA is installed from the same origin as `WEBAUTHN_RP_ID`. If the PWA scope differs from production hostname, align `WEBAUTHN_RP_ID` with the URL users actually open.

Use **Settings → Install Admin App** after passkey registration so mobile sign-in matches the registered RP ID.

## API routes

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| POST | `/api/admin/passkeys/register/options` | Session | Start passkey registration |
| POST | `/api/admin/passkeys/register/verify` | Session | Complete registration |
| GET | `/api/admin/passkeys` | Session | List passkeys |
| DELETE | `/api/admin/passkeys/[id]` | Session | Remove passkey |
| POST | `/api/admin/passkeys/login/options` | Public | Start passkey login |
| POST | `/api/admin/passkeys/login/verify` | Public | Complete login + session |
| POST | `/api/admin/backup-codes/generate` | Session | Generate recovery codes |
| POST | `/api/admin/backup-codes/login` | Public | Sign in with backup code |
| POST | `/api/admin/change-password` | Session | Change team password |

## Manual Supabase step

Run in SQL Editor:

```sql
-- Paste contents of supabase/migrations/072_admin_passkeys.sql
```

Confirm tables exist: `platform_user_passkeys`, `platform_webauthn_challenges`, `platform_user_backup_codes`.

## Owner limitation

The env-based owner account cannot register passkeys. This is intentional: the owner is not a `platform_users` row. For day-to-day passkey use, create a platform user with the `owner` role via **Users & roles** and register a passkey on that account.
