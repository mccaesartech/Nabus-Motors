-- IAM foundation: login attempts, lockouts, history, sessions, customer MFA
-- Next migration after 086_postgres_error_clearance.sql
--
-- user_id columns hold the customer UUID (profiles.id) as a plain UUID. They
-- carry no foreign key into auth.users: identity is owned by the external
-- provider (see 090_external_auth_migration.sql) and auth is a Supabase-managed
-- schema this role cannot depend on or alter.

-- Failed / successful customer auth attempts (rate limit + lockout + audit)
CREATE TABLE IF NOT EXISTS customer_auth_attempts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email TEXT NOT NULL,
  user_id UUID,
  ip TEXT,
  user_agent TEXT,
  success BOOLEAN NOT NULL DEFAULT false,
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_customer_auth_attempts_email_created
  ON customer_auth_attempts (lower(email), created_at DESC);

CREATE INDEX IF NOT EXISTS idx_customer_auth_attempts_ip_created
  ON customer_auth_attempts (ip, created_at DESC);

-- Account lockouts (temporary)
CREATE TABLE IF NOT EXISTS customer_auth_lockouts (
  email TEXT PRIMARY KEY,
  failed_count INT NOT NULL DEFAULT 0,
  locked_until TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Login history shown in account settings
CREATE TABLE IF NOT EXISTS customer_login_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL,
  email TEXT,
  ip TEXT,
  user_agent TEXT,
  browser TEXT,
  device TEXT,
  os TEXT,
  country TEXT,
  city TEXT,
  success BOOLEAN NOT NULL DEFAULT true,
  method TEXT NOT NULL DEFAULT 'password',
  suspicious BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_customer_login_history_user_created
  ON customer_login_history (user_id, created_at DESC);

-- Active / revocable customer sessions (device inventory)
CREATE TABLE IF NOT EXISTS customer_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL,
  session_fingerprint TEXT NOT NULL,
  refresh_token_hash TEXT,
  ip TEXT,
  user_agent TEXT,
  browser TEXT,
  device TEXT,
  os TEXT,
  country TEXT,
  city TEXT,
  last_active_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  revoked_at TIMESTAMPTZ,
  UNIQUE (user_id, session_fingerprint)
);

CREATE INDEX IF NOT EXISTS idx_customer_sessions_user_active
  ON customer_sessions (user_id, last_active_at DESC)
  WHERE revoked_at IS NULL;

-- Customer TOTP MFA
CREATE TABLE IF NOT EXISTS customer_mfa_totp (
  user_id UUID PRIMARY KEY,
  secret_encrypted TEXT NOT NULL,
  enabled_at TIMESTAMPTZ,
  enforced_by_admin BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS customer_mfa_backup_codes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL,
  code_hash TEXT NOT NULL,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_customer_mfa_backup_codes_user
  ON customer_mfa_backup_codes (user_id)
  WHERE used_at IS NULL;

-- Platform MFA enforce flag (settings-friendly column on platform_users)
ALTER TABLE platform_users
  ADD COLUMN IF NOT EXISTS mfa_required BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE platform_users
  ADD COLUMN IF NOT EXISTS totp_secret_encrypted TEXT;

ALTER TABLE platform_users
  ADD COLUMN IF NOT EXISTS totp_enabled_at TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS platform_mfa_backup_codes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  platform_user_id UUID NOT NULL REFERENCES platform_users(id) ON DELETE CASCADE,
  code_hash TEXT NOT NULL,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_platform_mfa_backup_codes_user
  ON platform_mfa_backup_codes (platform_user_id)
  WHERE used_at IS NULL;

-- RLS: service role only (app uses admin client)
ALTER TABLE customer_auth_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer_auth_lockouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer_login_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer_mfa_totp ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer_mfa_backup_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE platform_mfa_backup_codes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "No public access to customer_auth_attempts" ON customer_auth_attempts;
CREATE POLICY "No public access to customer_auth_attempts"
  ON customer_auth_attempts FOR ALL USING (false) WITH CHECK (false);

DROP POLICY IF EXISTS "No public access to customer_auth_lockouts" ON customer_auth_lockouts;
CREATE POLICY "No public access to customer_auth_lockouts"
  ON customer_auth_lockouts FOR ALL USING (false) WITH CHECK (false);

-- Customers read their own history/sessions/MFA state through server routes that
-- verify the external session, so no auth.uid() policy is possible or needed.
DROP POLICY IF EXISTS "Users can view own login history" ON customer_login_history;
DROP POLICY IF EXISTS "No public insert login history" ON customer_login_history;
DROP POLICY IF EXISTS "No public access to customer_login_history" ON customer_login_history;
CREATE POLICY "No public access to customer_login_history"
  ON customer_login_history FOR ALL USING (false) WITH CHECK (false);

DROP POLICY IF EXISTS "Users can view own sessions" ON customer_sessions;
DROP POLICY IF EXISTS "No public mutate sessions" ON customer_sessions;
CREATE POLICY "No public mutate sessions"
  ON customer_sessions FOR ALL USING (false) WITH CHECK (false);

DROP POLICY IF EXISTS "Users can view own mfa status" ON customer_mfa_totp;
DROP POLICY IF EXISTS "No public mutate customer mfa" ON customer_mfa_totp;
CREATE POLICY "No public mutate customer mfa"
  ON customer_mfa_totp FOR ALL USING (false) WITH CHECK (false);

DROP POLICY IF EXISTS "No public access customer backup codes" ON customer_mfa_backup_codes;
CREATE POLICY "No public access customer backup codes"
  ON customer_mfa_backup_codes FOR ALL USING (false) WITH CHECK (false);

DROP POLICY IF EXISTS "No public access platform mfa backup codes" ON platform_mfa_backup_codes;
CREATE POLICY "No public access platform mfa backup codes"
  ON platform_mfa_backup_codes FOR ALL USING (false) WITH CHECK (false);
