# Phase 8 — Session management

## Delivered
- `customer_sessions` table + upsert on login
- `GET/DELETE /api/customer/sessions` — list, revoke one, revoke others
- Device/browser/OS/IP (+ country stub) on security settings page
- Password change forces global sign-out

## GeoIP
Country/city left nullable without paid GeoIP; wire free header/`CF-IPCountry` later if available.