# Phase 14 — Branded emails

## Delivered
- Templates: welcome, verify, reset, invite, password changed, login alert, new device, MFA on/off
- File: `src/lib/email/branded-templates.ts`

## Remaining
- Call sites from login/MFA/register/reset to Resend send helper
- Ensure `RESEND_FROM_EMAIL` verified domain