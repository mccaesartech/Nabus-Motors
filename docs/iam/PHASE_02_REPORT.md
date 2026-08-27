# Phase 2 — Login

## Delivered
- Server-gated password login: `POST /api/customer/login`
- In-memory + DB lockout (`customer_auth_lockouts`) after failed attempts
- IP/email rate limits; suspicious login detection vs history
- Friendly errors only (`login-errors.ts`); failures logged via `logAppError` → Sentry
- Remember Me + Show Password preserved; multi-submit blocked while `loading`
- Session preference + 24h absolute expiry unchanged

## Verify
1. Wrong password 5× → lockout message
2. Valid login → account redirect; suspicious banner when new IP pattern

## Notes
Distributed rate limit (Upstash) not added; Map-based limit softens multi-instance bursts.