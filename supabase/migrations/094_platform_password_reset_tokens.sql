-- =============================================================================
-- 094 — Platform staff self-serve password reset tokens
-- =============================================================================
-- DO NOT apply remotely from CI/agent — run in the Supabase SQL Editor after review.
--
-- Design:
--   - One-time hashed tokens (SHA-256 of random secret).
--   - Short TTL enforced in application code (1 hour).
--   - Service role only; RLS denies all public access.
--
-- Reversal:
--   DROP TABLE IF EXISTS public.platform_password_reset_tokens;
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.platform_password_reset_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.platform_users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  requested_ip TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_platform_password_reset_tokens_user_unused
  ON public.platform_password_reset_tokens(user_id)
  WHERE used_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_platform_password_reset_tokens_expires
  ON public.platform_password_reset_tokens(expires_at);

ALTER TABLE public.platform_password_reset_tokens ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "No public access to platform password reset tokens"
  ON public.platform_password_reset_tokens;
CREATE POLICY "No public access to platform password reset tokens"
  ON public.platform_password_reset_tokens
  FOR ALL
  USING (false)
  WITH CHECK (false);