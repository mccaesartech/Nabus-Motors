# IAM Program Index

True Goshen Auto — Identity & Access Management (15-phase program).

| Phase | Document | Status |
|-------|----------|--------|
| 1 Audit | [PHASE_01_AUDIT.md](./PHASE_01_AUDIT.md) | Complete |
| 2 Login | [PHASE_02_REPORT.md](./PHASE_02_REPORT.md) | Complete |
| 3 Registration | [PHASE_03_REPORT.md](./PHASE_03_REPORT.md) | Complete |
| 4 Email verification | [PHASE_04_REPORT.md](./PHASE_04_REPORT.md) | Partial (app + templates; SMTP/dashboard external) |
| 5 Password reset | [PHASE_05_REPORT.md](./PHASE_05_REPORT.md) | Complete |
| 6 Google OAuth | [PHASE_06_REPORT.md](./PHASE_06_REPORT.md) | Code ready; custom domain external |
| 7 MFA | [PHASE_07_REPORT.md](./PHASE_07_REPORT.md) | Complete (TOTP + backup codes) |
| 8 Session management | [PHASE_08_REPORT.md](./PHASE_08_REPORT.md) | Complete |
| 9 Login history | [PHASE_09_REPORT.md](./PHASE_09_REPORT.md) | Complete |
| 10 RBAC | [PHASE_10_REPORT.md](./PHASE_10_REPORT.md) | Complete |
| 11 Security hardening | [PHASE_11_REPORT.md](./PHASE_11_REPORT.md) | Complete |
| 12 Error pages | [PHASE_12_REPORT.md](./PHASE_12_REPORT.md) | Complete |
| 13 Sentry | [PHASE_13_REPORT.md](./PHASE_13_REPORT.md) | Partial (replay flag; admin UI stub) |
| 14 Branded emails | [PHASE_14_REPORT.md](./PHASE_14_REPORT.md) | Templates ready; wire to Resend senders |
| 15 Final audit | [FINAL_AUDIT.md](./FINAL_AUDIT.md) | Complete |

**Migrations to apply:** `087_iam_auth_foundation.sql`, `088_iam_platform_roles.sql`

### Login / new-device alerts (required tables)

Customer new-device alerts and login history need migration **087** applied in the Supabase SQL Editor if not already present (`supabase/migrations/087_iam_auth_foundation.sql`). That migration creates `customer_sessions`, `customer_login_history`, `customer_auth_attempts`, `customer_auth_lockouts`, and MFA tables.

Without `customer_sessions`, session fingerprints soft-fail and **no** customer new-device email/SMS is sent. Platform staff login alerts use existing `notification_log` + Resend/Arkesel and do not depend on 087.

Related: [SUPABASE_AUTH_DOMAIN.md](../SUPABASE_AUTH_DOMAIN.md), [GOOGLE_AUTH.md](../GOOGLE_AUTH.md).