# Phase 13 — Sentry deepen

## Delivered
- Client Replay gated by `NEXT_PUBLIC_SENTRY_REPLAY=1`
- Existing server/edge/client + `logAppError` path retained

## Remaining
- Admin UI toggle for replay sample rates (settings store)
- Explicit middleware/auth/DB transaction spans beyond default tracing