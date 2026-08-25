-- Require platform team members to replace admin-assigned temporary passwords
-- before accessing the admin console.

ALTER TABLE platform_users
  ADD COLUMN IF NOT EXISTS must_change_password BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN platform_users.must_change_password IS
  'When true, the user must change their password before accessing platform routes. Set when an owner/admin assigns a temporary password.';

CREATE INDEX IF NOT EXISTS idx_platform_users_must_change_password
  ON platform_users (must_change_password)
  WHERE must_change_password = true;