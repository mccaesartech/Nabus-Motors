-- =============================================================================
-- 103 - Customer reauth codes: service_role grants + PostgREST schema reload
-- =============================================================================
-- DO NOT apply remotely from CI/agent - run in the Supabase SQL Editor after review.
--
-- Required when 102_customer_reauth_codes.sql was applied but:
--   - PostgREST still returns "Could not find the table ... in the schema cache"
--   - or the service role lacks table privileges
--
-- Safe to re-run.
-- =============================================================================

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.customer_reauth_codes TO service_role;

NOTIFY pgrst, 'reload schema';