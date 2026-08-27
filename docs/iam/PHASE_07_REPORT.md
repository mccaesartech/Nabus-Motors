# Phase 7 — MFA (TOTP)

## Delivered
- Pure TOTP + backup codes (`src/lib/security/totp.ts`)
- API `GET/POST /api/customer/mfa` (enroll/confirm/disable)
- UI `/account/settings/security`
- Tables in `087_iam_auth_foundation.sql`; `platform_users.mfa_required`

## Notes
- QR via qrserver.com (CSP allows); prefer offline QR later
- Encrypt secrets with `MFA_ENCRYPTION_KEY` or `ADMIN_SECRET`
- Admin enforce UI can set `enforced_by_admin` / `mfa_required` (API hook ready)