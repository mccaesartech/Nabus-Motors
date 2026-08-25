-- =============================================================================
-- 092 — Security hardening
-- =============================================================================
-- 1) Deny client-side writes to customer-avatars (service role bypasses RLS)
-- 2) credentials_revoked_at for bearer invalidation after global session revoke
-- 3) Shared rate-limit counters for serverless auth endpoints
-- =============================================================================

-- Avatar bucket: remove overly permissive write policies from 091 if present.
DROP POLICY IF EXISTS "Service role upload customer avatars" ON storage.objects;
DROP POLICY IF EXISTS "Service role update customer avatars" ON storage.objects;
DROP POLICY IF EXISTS "Service role delete customer avatars" ON storage.objects;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS credentials_revoked_at TIMESTAMPTZ;

COMMENT ON COLUMN public.profiles.credentials_revoked_at IS
  'When set, bearer access tokens with JWT iat earlier than this timestamp are rejected.';

CREATE TABLE IF NOT EXISTS public.platform_rate_limits (
  key TEXT PRIMARY KEY,
  count INTEGER NOT NULL DEFAULT 0,
  reset_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_platform_rate_limits_reset
  ON public.platform_rate_limits (reset_at);

ALTER TABLE public.platform_rate_limits ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "No public access platform_rate_limits" ON public.platform_rate_limits;
CREATE POLICY "No public access platform_rate_limits"
  ON public.platform_rate_limits FOR ALL USING (false) WITH CHECK (false);