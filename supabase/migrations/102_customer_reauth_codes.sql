-- =============================================================================
-- 102 - Customer re-authentication codes (6-digit OTP)
-- =============================================================================
-- DO NOT apply remotely from CI/agent - run in the Supabase SQL Editor after review.
--
-- Required before account deletion email codes work in production.
--
-- Reversal:
--   DROP TABLE IF EXISTS public.customer_reauth_codes;
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.customer_reauth_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  purpose TEXT NOT NULL,
  code_hash TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  requested_ip TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_customer_reauth_codes_user_purpose_unused
  ON public.customer_reauth_codes (user_id, purpose, created_at DESC)
  WHERE used_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_customer_reauth_codes_expires
  ON public.customer_reauth_codes (expires_at);

ALTER TABLE public.customer_reauth_codes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "No public access to customer reauth codes"
  ON public.customer_reauth_codes;
CREATE POLICY "No public access to customer reauth codes"
  ON public.customer_reauth_codes
  FOR ALL
  USING (false)
  WITH CHECK (false);

COMMENT ON TABLE public.customer_reauth_codes IS
  'Hashed one-time 6-digit codes for customer re-authentication (deletion, restore).';
