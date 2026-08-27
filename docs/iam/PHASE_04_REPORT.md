# Phase 4 — Email verification

## Delivered
- Signup `emailRedirectTo` → `/auth/callback`
- Login banner `?verify=1` after signup without session
- Branded verify template: `verifyEmail()` in `branded-templates.ts`

## External (user)
- Supabase Auth: enable confirm email; custom SMTP / templates to hide Supabase branding
- Hook Resend sender to `verifyEmail` when not using Auth SMTP