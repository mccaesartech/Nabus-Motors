-- Enterprise error log — persisted store behind the admin Error Log screen.
-- DO NOT apply remotely from CI/agent — run in the Supabase SQL Editor after review.
--
-- The application degrades gracefully without this table: `src/lib/errors/logger.ts`
-- detects a missing relation on its first insert, disables persistence for that
-- instance, and continues with structured console logging only. Nothing breaks
-- if this migration has not been run yet.
--
-- Privacy: `request_body` is written through `src/lib/errors/sanitize.ts`, which
-- redacts passwords/tokens/keys, masks emails and phone numbers, and replaces
-- free-text fields with a length marker. No secrets are stored here.
--
-- Reversal:
--   DROP TABLE IF EXISTS platform_error_log;

CREATE TABLE IF NOT EXISTS platform_error_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  -- Support-facing correlation id, format TG-XXXXXX.
  error_id TEXT NOT NULL,
  severity TEXT NOT NULL DEFAULT 'high'
    CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  kind TEXT NOT NULL DEFAULT 'unknown',
  status INTEGER NOT NULL DEFAULT 500,
  -- Dotted handler path, e.g. api.admin.vehicles.PATCH.
  module TEXT NOT NULL,
  method TEXT,
  route TEXT,
  -- Exactly what the user was shown.
  user_message TEXT,
  -- Raw provider/database text — admin-only, never returned to a client.
  internal_message TEXT,
  db_code TEXT,
  actor_id UUID,
  actor_role TEXT,
  ip TEXT,
  browser TEXT,
  os TEXT,
  environment TEXT,
  release TEXT,
  stack TEXT,
  request_body JSONB,
  context JSONB NOT NULL DEFAULT '{}'::jsonb,
  resolved_at TIMESTAMPTZ,
  resolved_by_user_id UUID REFERENCES platform_users(id) ON DELETE SET NULL,
  resolution_note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Support flow: a customer quotes TG-XXXXXX and staff look it up directly.
CREATE UNIQUE INDEX IF NOT EXISTS idx_platform_error_log_error_id
  ON platform_error_log (error_id);

CREATE INDEX IF NOT EXISTS idx_platform_error_log_created_at
  ON platform_error_log (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_platform_error_log_severity_created
  ON platform_error_log (severity, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_platform_error_log_module_created
  ON platform_error_log (module, created_at DESC);

-- Default list view is "unresolved, newest first".
CREATE INDEX IF NOT EXISTS idx_platform_error_log_unresolved
  ON platform_error_log (created_at DESC)
  WHERE resolved_at IS NULL;

ALTER TABLE platform_error_log ENABLE ROW LEVEL SECURITY;

-- Service-role only, matching every other platform-internal table.
DROP POLICY IF EXISTS "Service role manages platform_error_log" ON platform_error_log;
CREATE POLICY "Service role manages platform_error_log"
  ON platform_error_log FOR ALL USING (false) WITH CHECK (false);

-- Optional retention job (run manually or schedule with pg_cron):
--   DELETE FROM platform_error_log
--   WHERE resolved_at IS NOT NULL AND created_at < NOW() - INTERVAL '180 days';
