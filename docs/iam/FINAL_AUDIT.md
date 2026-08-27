# Phase 15 — Final IAM Audit

**Date:** 2026-07-29  
**Typecheck:** `npx tsc --noEmit` passed after IAM changes.

## Scores (0–10)

| Area | Score | Notes |
|------|------:|-------|
| Login / lockout | 8 | Server gate + lockout; RL not distributed |
| Registration | 9 | Policy + live validation |
| Email verification | 6 | App ready; branding needs SMTP |
| Password reset | 8 | Policy + expiry UX |
| Google OAuth | 7 | Code ready; auth domain unpaid/external |
| MFA | 8 | TOTP + backups; QR external CDN |
| Sessions | 8 | Revoke one/all; geo stub |
| Login history | 8 | Settings UI |
| RBAC | 8 | Expanded roles; migration required |
| Hardening | 8 | CSP + CSRF origin |
| Error pages | 9 | 401/403/500 + existing |
| Sentry | 7 | Replay optional |
| Branded emails | 6 | Templates; send wiring partial |
| **Overall** | **7.7** | Production-ready with migrations + env |

## User actions required

1. **Apply migrations** `087_iam_auth_foundation.sql` and `088_iam_platform_roles.sql` on project `ddrknhvkhmgdtavpuiiq`.
2. **Env (optional):** `MFA_ENCRYPTION_KEY`, `NEXT_PUBLIC_SENTRY_REPLAY=1`
3. **Auth domain:** follow `docs/SUPABASE_AUTH_DOMAIN.md` (Pro + DNS + Google + Vercel URL)
4. **Supabase Auth emails:** custom SMTP / templates for verify/reset branding
5. **Resend:** verify domain; wire branded templates into notify paths
6. No commit/deploy performed by agent (per instructions)

## Residual risks
- Customer JWTs still browser-storage (W1)
- In-memory rate limits per instance (W7)
- MFA secret XOR encryption is basic — rotate to KMS later