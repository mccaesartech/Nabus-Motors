-- Expand platform_users.role for IAM job titles (keeps Owner/Manager/Staff/Super Admin)

ALTER TABLE platform_users DROP CONSTRAINT IF EXISTS platform_users_role_check;

ALTER TABLE platform_users
  ADD CONSTRAINT platform_users_role_check
  CHECK (role IN (
    'owner',
    'super_admin',
    'administrator',
    'manager',
    'sales_officer',
    'inventory_officer',
    'freight_officer',
    'accounts',
    'staff'
  ));

-- Map any lingering display labels
UPDATE platform_users SET role = 'sales_officer' WHERE role IN ('Sales Officer');
UPDATE platform_users SET role = 'accounts' WHERE role IN ('Finance Officer', 'Accounts');
UPDATE platform_users SET role = 'administrator' WHERE role IN ('Administrator');
UPDATE platform_users SET role = 'inventory_officer' WHERE role IN ('Inventory Officer');
UPDATE platform_users SET role = 'freight_officer' WHERE role IN ('Freight Officer');