# Phase 10 — RBAC

## Delivered
- Roles: owner, super_admin, administrator, manager, sales_officer, inventory_officer, freight_officer, accounts, staff
- Legacy labels mapped; Owner/Manager/Staff preserved
- Migration `088_iam_platform_roles.sql` expands DB CHECK
- Permission matrices in `permissions.ts`; Customer remains Supabase profiles (not platform_users)

## Mapping to request
| Requested | Implementation |
|-----------|----------------|
| Customer | auth.users / profiles |
| Sales Officer | sales_officer |
| Inventory Officer | inventory_officer |
| Freight Officer | freight_officer |
| Accounts | accounts |
| Administrator | administrator |
| Super Administrator | super_admin (+ owner above) |