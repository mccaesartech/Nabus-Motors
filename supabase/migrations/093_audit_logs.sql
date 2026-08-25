-- =============================================================================
-- 093 — Immutable audit_logs (security / ops trail)
-- =============================================================================
-- DO NOT apply remotely from CI/agent — run in the Supabase SQL Editor after review.
--
-- Design:
--   - INSERT-only for the application (service role bypasses RLS).
--   - No UPDATE / DELETE policies for authenticated or anon roles.
--   - SELECT is denied at RLS; the platform API reads via service role and
--     gates access in application code (owner + super_admin only).
--   - Retention purge must run as a scheduled job / SQL Editor with service
--     role (or postgres) — there is intentionally no casual admin API delete.
--
-- Reversal:
--   DROP FUNCTION IF EXISTS public.purge_audit_logs_older_than_retention();
--   DROP TABLE IF EXISTS public.audit_logs;
--   DELETE FROM public.site_settings
--     WHERE key IN ('audit_log_retention_days', 'audit_log_enabled');
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  actor_user_id TEXT,
  actor_name TEXT,
  actor_role TEXT,
  action TEXT NOT NULL,
  target_type TEXT,
  target_id TEXT,
  target_name TEXT,
  ip_address TEXT,
  user_agent TEXT,
  browser TEXT,
  operating_system TEXT,
  request_id TEXT,
  success BOOLEAN NOT NULL DEFAULT true,
  error_message TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  -- Approximate geo from edge headers (e.g. Cloudflare cf-ipcountry); never blocking.
  country TEXT,
  region TEXT,
  city TEXT
);

COMMENT ON TABLE public.audit_logs IS
  'Immutable security/ops audit trail. Application writes via service role only.';

CREATE INDEX IF NOT EXISTS idx_audit_logs_timestamp
  ON public.audit_logs (timestamp DESC);

CREATE INDEX IF NOT EXISTS idx_audit_logs_actor_user_id
  ON public.audit_logs (actor_user_id)
  WHERE actor_user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_audit_logs_action
  ON public.audit_logs (action);

CREATE INDEX IF NOT EXISTS idx_audit_logs_success
  ON public.audit_logs (success);

CREATE INDEX IF NOT EXISTS idx_audit_logs_target
  ON public.audit_logs (target_type, target_id)
  WHERE target_type IS NOT NULL;

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Deny all client access. Service role bypasses RLS for INSERT/SELECT.
DROP POLICY IF EXISTS "No client access audit_logs" ON public.audit_logs;
CREATE POLICY "No client access audit_logs"
  ON public.audit_logs
  FOR ALL
  USING (false)
  WITH CHECK (false);

-- Explicit revoke of DML from common roles (defense in depth; service_role still bypasses).
REVOKE UPDATE, DELETE ON public.audit_logs FROM PUBLIC;
REVOKE UPDATE, DELETE ON public.audit_logs FROM anon, authenticated;

-- Retention defaults in site_settings (application also ships code defaults).
INSERT INTO public.site_settings (key, value)
VALUES
  ('audit_log_retention_days', '365'),
  ('audit_log_enabled', 'true')
ON CONFLICT (key) DO NOTHING;

-- Retention purge (manual / pg_cron). Safe delete only via this path.
-- Example (pg_cron, weekly):
--   SELECT cron.schedule(
--     'purge-audit-logs',
--     '0 4 * * 0',
--     'SELECT public.purge_audit_logs_older_than_retention()'
--   );
-- Manual:
--   SELECT public.purge_audit_logs_older_than_retention();
CREATE OR REPLACE FUNCTION public.purge_audit_logs_older_than_retention()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $purge$
DECLARE
  days INTEGER;
  deleted INTEGER;
BEGIN
  SELECT COALESCE(NULLIF(trim(value), '')::INTEGER, 365)
    INTO days
  FROM public.site_settings
  WHERE key = 'audit_log_retention_days';

  IF days IS NULL OR days < 1 THEN
    days := 365;
  END IF;

  -- Cap at a sane minimum so a mis-set "0" cannot wipe the table.
  IF days < 30 THEN
    days := 30;
  END IF;

  DELETE FROM public.audit_logs
  WHERE timestamp < NOW() - make_interval(days => days);

  GET DIAGNOSTICS deleted = ROW_COUNT;
  RETURN deleted;
END;
$purge$;

COMMENT ON FUNCTION public.purge_audit_logs_older_than_retention() IS
  'Deletes audit_logs older than site_settings.audit_log_retention_days (min 30, default 365). Run via cron/service role only.';

REVOKE ALL ON FUNCTION public.purge_audit_logs_older_than_retention() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.purge_audit_logs_older_than_retention() TO service_role;
