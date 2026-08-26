-- =============================================================================
-- 099 — Exchange rate last-good cache + immutable FX snapshots
-- =============================================================================
-- DO NOT apply remotely from CI/agent — run in the Supabase SQL Editor after review.
--
-- Purpose:
--   1. Persist the last successful USD-base mid-market feed so cold starts do
--      not fall back to ancient NEXT_PUBLIC_USD_TO_* env defaults.
--   2. Freeze the rate used on quotations, invoices, orders, payments, sales,
--      pre-orders, and expenses. Past documents MUST NOT change when today's
--      market rate moves.
--
-- Manual per-document overrides live on exchange_rate_snapshots (is_manual).
-- They never rewrite the live market feed.
--
-- Reversal:
--   DROP TABLE IF EXISTS public.exchange_rate_snapshots;
--   DROP TABLE IF EXISTS public.exchange_rate_cache;
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.exchange_rate_cache (
  id TEXT PRIMARY KEY DEFAULT 'usd',
  rates JSONB NOT NULL,
  rates_from_ghs JSONB,
  source TEXT NOT NULL,
  provider TEXT NOT NULL DEFAULT 'exchangerate-api',
  stale BOOLEAN NOT NULL DEFAULT false,
  fetched_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  rate_date TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.exchange_rate_cache IS
  'Last successful USD-base mid-market rates. Used when the live provider is down. Not a substitute for document snapshots.';

ALTER TABLE public.exchange_rate_cache ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "No client access exchange_rate_cache" ON public.exchange_rate_cache;
CREATE POLICY "No client access exchange_rate_cache"
  ON public.exchange_rate_cache
  FOR ALL
  USING (false)
  WITH CHECK (false);

REVOKE ALL ON public.exchange_rate_cache FROM PUBLIC;
REVOKE ALL ON public.exchange_rate_cache FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON public.exchange_rate_cache TO service_role;

CREATE TABLE IF NOT EXISTS public.exchange_rate_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type TEXT NOT NULL,
  entity_id UUID NOT NULL,
  source_currency TEXT NOT NULL DEFAULT 'USD',
  target_currency TEXT NOT NULL DEFAULT 'GHS',
  original_amount NUMERIC(18, 4) NOT NULL,
  rate_used NUMERIC(18, 8) NOT NULL,
  converted_amount NUMERIC(18, 4) NOT NULL,
  retrieved_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  provider TEXT NOT NULL DEFAULT 'exchangerate-api',
  source TEXT NOT NULL DEFAULT 'exchangerate-api',
  rate_date TEXT,
  rates_json JSONB,
  is_manual BOOLEAN NOT NULL DEFAULT false,
  previous_live_rate NUMERIC(18, 8),
  override_reason TEXT,
  override_actor_id TEXT,
  override_actor_name TEXT,
  override_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT exchange_rate_snapshots_entity_unique
    UNIQUE (entity_type, entity_id, source_currency, target_currency),
  CONSTRAINT exchange_rate_snapshots_codes_chk
    CHECK (
      char_length(source_currency) = 3
      AND char_length(target_currency) = 3
    ),
  CONSTRAINT exchange_rate_snapshots_rate_chk
    CHECK (rate_used > 0),
  CONSTRAINT exchange_rate_snapshots_entity_type_chk
    CHECK (
      entity_type IN (
        'sale',
        'parts_order',
        'preorder',
        'expense',
        'quotation',
        'invoice',
        'payment'
      )
    )
);

COMMENT ON TABLE public.exchange_rate_snapshots IS
  'Immutable FX conversion used on a financial record. Updates are limited to owner/super_admin manual overrides (labelled, audited). Live market changes must not rewrite these rows.';

COMMENT ON COLUMN public.exchange_rate_snapshots.rate_used IS
  'Units of target_currency per 1 unit of source_currency at retrieved_at.';

COMMENT ON COLUMN public.exchange_rate_snapshots.rates_json IS
  'Optional full USD-base rate map at snapshot time so reprints in any currency stay frozen.';

COMMENT ON COLUMN public.exchange_rate_snapshots.is_manual IS
  'True when an owner/super_admin overrode the live mid-market rate for this document only.';

CREATE INDEX IF NOT EXISTS idx_exchange_rate_snapshots_entity
  ON public.exchange_rate_snapshots (entity_type, entity_id);

CREATE INDEX IF NOT EXISTS idx_exchange_rate_snapshots_retrieved
  ON public.exchange_rate_snapshots (retrieved_at DESC);

ALTER TABLE public.exchange_rate_snapshots ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "No client access exchange_rate_snapshots" ON public.exchange_rate_snapshots;
CREATE POLICY "No client access exchange_rate_snapshots"
  ON public.exchange_rate_snapshots
  FOR ALL
  USING (false)
  WITH CHECK (false);

REVOKE ALL ON public.exchange_rate_snapshots FROM PUBLIC;
REVOKE ALL ON public.exchange_rate_snapshots FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON public.exchange_rate_snapshots TO service_role;

DROP TRIGGER IF EXISTS exchange_rate_snapshots_updated_at ON public.exchange_rate_snapshots;
CREATE TRIGGER exchange_rate_snapshots_updated_at
  BEFORE UPDATE ON public.exchange_rate_snapshots
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
