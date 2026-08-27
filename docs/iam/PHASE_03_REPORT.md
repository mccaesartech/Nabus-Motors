# Phase 3 — Registration

## Delivered
- First + Last name fields (metadata `first_name` / `last_name` + `full_name`)
- Password policy: min 12 + upper/lower/number/special + strength meter
- Live email validation + optional duplicate check (`checkDuplicate`)
- Confirm password live mismatch hint; submit disabled until policy OK

## Files
- `src/app/register/page.tsx`
- `src/lib/customer/password-policy.ts`
- `src/components/customer/password-strength-meter.tsx`
- `src/app/api/customer/validate-email/route.ts`