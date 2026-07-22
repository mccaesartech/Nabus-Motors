-- Admin WebAuthn passkeys, challenges, and backup recovery codes (service role only)

CREATE TABLE IF NOT EXISTS platform_user_passkeys (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  platform_user_id UUID NOT NULL REFERENCES platform_users(id) ON DELETE CASCADE,
  credential_id TEXT NOT NULL UNIQUE,
  public_key TEXT NOT NULL,
  counter BIGINT NOT NULL DEFAULT 0,
  device_name TEXT,
  transports TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_used_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_platform_user_passkeys_user
  ON platform_user_passkeys(platform_user_id);

CREATE TABLE IF NOT EXISTS platform_webauthn_challenges (
  challenge TEXT PRIMARY KEY,
  platform_user_id UUID REFERENCES platform_users(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('registration', 'authentication')),
  expires_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_platform_webauthn_challenges_expires
  ON platform_webauthn_challenges(expires_at);

CREATE INDEX IF NOT EXISTS idx_platform_webauthn_challenges_user
  ON platform_webauthn_challenges(platform_user_id)
  WHERE platform_user_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS platform_user_backup_codes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  platform_user_id UUID NOT NULL REFERENCES platform_users(id) ON DELETE CASCADE,
  code_hash TEXT NOT NULL,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_platform_user_backup_codes_user
  ON platform_user_backup_codes(platform_user_id)
  WHERE used_at IS NULL;

ALTER TABLE platform_user_passkeys ENABLE ROW LEVEL SECURITY;
ALTER TABLE platform_webauthn_challenges ENABLE ROW LEVEL SECURITY;
ALTER TABLE platform_user_backup_codes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "No public access to platform user passkeys" ON platform_user_passkeys;
CREATE POLICY "No public access to platform user passkeys"
  ON platform_user_passkeys FOR ALL USING (false) WITH CHECK (false);

DROP POLICY IF EXISTS "No public access to platform webauthn challenges" ON platform_webauthn_challenges;
CREATE POLICY "No public access to platform webauthn challenges"
  ON platform_webauthn_challenges FOR ALL USING (false) WITH CHECK (false);

DROP POLICY IF EXISTS "No public access to platform user backup codes" ON platform_user_backup_codes;
CREATE POLICY "No public access to platform user backup codes"
  ON platform_user_backup_codes FOR ALL USING (false) WITH CHECK (false);
