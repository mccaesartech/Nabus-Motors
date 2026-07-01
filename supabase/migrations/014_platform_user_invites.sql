-- Platform user invitations, roles, passwords (hashed), and activity log

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Extend platform_users for auth and profiles
ALTER TABLE platform_users
  ADD COLUMN IF NOT EXISTS password_hash TEXT,
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS phone TEXT,
  ADD COLUMN IF NOT EXISTS job_title TEXT,
  ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS invited_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS activated_at TIMESTAMPTZ;

ALTER TABLE platform_users DROP CONSTRAINT IF EXISTS platform_users_status_check;
ALTER TABLE platform_users
  ADD CONSTRAINT platform_users_status_check
  CHECK (status IN ('pending', 'active', 'disabled'));

ALTER TABLE platform_users DROP CONSTRAINT IF EXISTS platform_users_role_check;
ALTER TABLE platform_users
  ADD CONSTRAINT platform_users_role_check
  CHECK (role IN ('owner', 'super_admin', 'manager', 'staff'));

-- Map legacy display roles to canonical slugs
UPDATE platform_users SET role = 'super_admin' WHERE role IN ('Super Admin', 'super_admin');
UPDATE platform_users SET role = 'manager' WHERE role IN ('Manager', 'manager');
UPDATE platform_users SET role = 'staff' WHERE role IN ('Sales Officer', 'Finance Officer', 'Viewer', 'staff');
UPDATE platform_users SET role = 'owner' WHERE role IN ('owner', 'Owner');

UPDATE platform_users SET role = 'staff' WHERE role NOT IN ('owner', 'super_admin', 'manager', 'staff');

ALTER TABLE platform_users ALTER COLUMN role SET DEFAULT 'staff';

-- Invitations (token stored hashed; plain token only in invite link)
CREATE TABLE IF NOT EXISTS platform_user_invites (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES platform_users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  accepted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_platform_user_invites_user ON platform_user_invites(user_id);
CREATE INDEX IF NOT EXISTS idx_platform_user_invites_expires ON platform_user_invites(expires_at);

-- Owner activity monitoring
CREATE TABLE IF NOT EXISTS platform_activity_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES platform_users(id) ON DELETE SET NULL,
  actor_name TEXT,
  actor_email TEXT,
  action TEXT NOT NULL,
  resource TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_platform_activity_created ON platform_activity_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_platform_activity_user ON platform_activity_log(user_id);

ALTER TABLE platform_user_invites ENABLE ROW LEVEL SECURITY;
ALTER TABLE platform_activity_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role manages platform_user_invites" ON platform_user_invites;
CREATE POLICY "Service role manages platform_user_invites"
  ON platform_user_invites FOR ALL USING (false) WITH CHECK (false);

DROP POLICY IF EXISTS "Service role manages platform_activity_log" ON platform_activity_log;
CREATE POLICY "Service role manages platform_activity_log"
  ON platform_activity_log FOR ALL USING (false) WITH CHECK (false);
