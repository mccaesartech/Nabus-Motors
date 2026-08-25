-- =============================================================================
-- 086 — Postgres error clearance (idempotent catch-up for 075–085)
-- =============================================================================
-- Paste once in Supabase SQL Editor for project ddrknhvkhmgdtavpuiiq.
-- Safe to re-run: IF NOT EXISTS / ON CONFLICT DO NOTHING throughout.
--
-- Clears production Postgres log spam from app queries against schema that
-- shipped in code but was never applied remotely:
--   42703  undefined_column  (deleted_at, stock_quantity, price_currency, …)
--   42P01 / PGRST205         (inventory_movements, dismissals, error_log, …)
--
-- After success: Dashboard → Logs → Postgres → confirm new errors stop.
-- Also reloads PostgREST schema cache at the end.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Soft-delete columns (054 / 078 / 079 / 080) — only adds if missing
-- ---------------------------------------------------------------------------

ALTER TABLE vehicles
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS deleted_by_user_id UUID REFERENCES platform_users(id) ON DELETE SET NULL;

ALTER TABLE expenses
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS deleted_by_user_id UUID REFERENCES platform_users(id) ON DELETE SET NULL;

ALTER TABLE sales
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS deleted_by_user_id UUID REFERENCES platform_users(id) ON DELETE SET NULL;

ALTER TABLE parts_orders
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS deleted_by_user_id UUID REFERENCES platform_users(id) ON DELETE SET NULL;

ALTER TABLE preorder_inquiries
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS deleted_by_user_id UUID REFERENCES platform_users(id) ON DELETE SET NULL;

ALTER TABLE contact_inquiries
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS deleted_by_user_id UUID REFERENCES platform_users(id) ON DELETE SET NULL;

ALTER TABLE finance_applications
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS deleted_by_user_id UUID REFERENCES platform_users(id) ON DELETE SET NULL;

ALTER TABLE appraisal_requests
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS deleted_by_user_id UUID REFERENCES platform_users(id) ON DELETE SET NULL;

ALTER TABLE vehicle_inquiries
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS deleted_by_user_id UUID REFERENCES platform_users(id) ON DELETE SET NULL;

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS deleted_by_user_id UUID REFERENCES platform_users(id) ON DELETE SET NULL;

ALTER TABLE platform_users
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS deleted_by_user_id UUID REFERENCES platform_users(id) ON DELETE SET NULL;

ALTER TABLE customer_conversations
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS deleted_by_user_id UUID REFERENCES platform_users(id) ON DELETE SET NULL;

ALTER TABLE admin_notifications
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS deleted_by_user_id UUID REFERENCES platform_users(id) ON DELETE SET NULL;

-- Soft-delete indexes
CREATE INDEX IF NOT EXISTS idx_vehicles_deleted_at
  ON vehicles (deleted_at) WHERE deleted_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_platform_users_deleted_at
  ON platform_users (deleted_at) WHERE deleted_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_customer_conversations_deleted_at
  ON customer_conversations (deleted_at) WHERE deleted_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_admin_notifications_deleted_at
  ON admin_notifications (deleted_at) WHERE deleted_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_profiles_deleted_at
  ON profiles (deleted_at) WHERE deleted_at IS NOT NULL;

-- Active-email uniqueness after platform_users soft-delete (078)
ALTER TABLE platform_users DROP CONSTRAINT IF EXISTS platform_users_email_key;
DROP INDEX IF EXISTS platform_users_email_key;
CREATE UNIQUE INDEX IF NOT EXISTS platform_users_email_active_unique
  ON platform_users (lower(email))
  WHERE deleted_at IS NULL;

-- ---------------------------------------------------------------------------
-- Vehicle pricing / stock (081 / 082)
-- ---------------------------------------------------------------------------

ALTER TABLE vehicles
  ADD COLUMN IF NOT EXISTS price_currency TEXT NOT NULL DEFAULT 'USD';

ALTER TABLE vehicles
  ADD COLUMN IF NOT EXISTS listed_price INTEGER;

UPDATE vehicles
SET listed_price = price
WHERE listed_price IS NULL
  AND price_currency = 'USD';

ALTER TABLE vehicles
  ADD COLUMN IF NOT EXISTS stock_quantity INTEGER NOT NULL DEFAULT 1;

ALTER TABLE vehicles
  DROP CONSTRAINT IF EXISTS vehicles_stock_quantity_check;

ALTER TABLE vehicles
  ADD CONSTRAINT vehicles_stock_quantity_check CHECK (stock_quantity >= 0);

-- Local vs shipment exclusive (069) — add only when missing and data is clean
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'vehicles_local_shipment_exclusive'
  ) THEN
    IF NOT EXISTS (
      SELECT 1 FROM vehicles
      WHERE available_locally IS TRUE AND shipment_available IS TRUE
    ) THEN
      ALTER TABLE vehicles
        ADD CONSTRAINT vehicles_local_shipment_exclusive
        CHECK (NOT (available_locally = true AND shipment_available = true));
    END IF;
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 075 — admin_notification_dismissals
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS admin_notification_dismissals (
  scope TEXT NOT NULL,
  notification_key TEXT NOT NULL,
  dismissed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (scope, notification_key)
);

CREATE INDEX IF NOT EXISTS idx_admin_notification_dismissals_scope_dismissed
  ON admin_notification_dismissals (scope, dismissed_at DESC);

ALTER TABLE admin_notification_dismissals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "No public access to admin notification dismissals" ON admin_notification_dismissals;
CREATE POLICY "No public access to admin notification dismissals"
  ON admin_notification_dismissals FOR ALL USING (false) WITH CHECK (false);

-- ---------------------------------------------------------------------------
-- 076 — inventory_movements
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS inventory_movements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  direction TEXT NOT NULL CHECK (direction IN ('in', 'out')),
  asset_type TEXT NOT NULL CHECK (
    asset_type IN ('vehicle', 'part', 'expense', 'sale', 'preorder', 'order')
  ),
  movement_type TEXT NOT NULL,
  description TEXT NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  amount_usd INTEGER NOT NULL DEFAULT 0,
  asset_id UUID,
  reference_type TEXT,
  reference_id UUID,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  source TEXT NOT NULL DEFAULT 'system' CHECK (source IN ('system', 'backfill', 'manual')),
  created_by_user_id UUID REFERENCES platform_users(id) ON DELETE SET NULL,
  created_by_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_inventory_movements_dedup
  ON inventory_movements (movement_type, reference_type, reference_id)
  WHERE reference_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_inventory_movements_occurred_at
  ON inventory_movements (occurred_at DESC);

CREATE INDEX IF NOT EXISTS idx_inventory_movements_asset_type
  ON inventory_movements (asset_type);

CREATE INDEX IF NOT EXISTS idx_inventory_movements_direction
  ON inventory_movements (direction);

CREATE INDEX IF NOT EXISTS idx_inventory_movements_movement_type
  ON inventory_movements (movement_type);

ALTER TABLE inventory_movements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role manages inventory_movements" ON inventory_movements;
CREATE POLICY "Service role manages inventory_movements"
  ON inventory_movements FOR ALL USING (false) WITH CHECK (false);

-- ---------------------------------------------------------------------------
-- 083 — admin interaction indexes (require deleted_at above)
-- ---------------------------------------------------------------------------

CREATE INDEX IF NOT EXISTS idx_finance_applications_status_created
  ON finance_applications (status, created_at DESC)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_appraisal_requests_status_created
  ON appraisal_requests (status, created_at DESC)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_admin_notifications_recipient_user_created
  ON admin_notifications (recipient_user_id, created_at DESC)
  WHERE deleted_at IS NULL AND recipient_user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_admin_notifications_recipient_owner_created
  ON admin_notifications (created_at DESC)
  WHERE deleted_at IS NULL AND recipient_is_owner = true;

CREATE INDEX IF NOT EXISTS idx_vehicles_available_stock
  ON vehicles (status)
  INCLUDE (stock_quantity)
  WHERE deleted_at IS NULL AND status = 'available';

-- ---------------------------------------------------------------------------
-- 084 — platform_error_log
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS platform_error_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  error_id TEXT NOT NULL,
  severity TEXT NOT NULL DEFAULT 'high'
    CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  kind TEXT NOT NULL DEFAULT 'unknown',
  status INTEGER NOT NULL DEFAULT 500,
  module TEXT NOT NULL,
  method TEXT,
  route TEXT,
  user_message TEXT,
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

CREATE UNIQUE INDEX IF NOT EXISTS idx_platform_error_log_error_id
  ON platform_error_log (error_id);

CREATE INDEX IF NOT EXISTS idx_platform_error_log_created_at
  ON platform_error_log (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_platform_error_log_severity_created
  ON platform_error_log (severity, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_platform_error_log_module_created
  ON platform_error_log (module, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_platform_error_log_unresolved
  ON platform_error_log (created_at DESC)
  WHERE resolved_at IS NULL;

ALTER TABLE platform_error_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role manages platform_error_log" ON platform_error_log;
CREATE POLICY "Service role manages platform_error_log"
  ON platform_error_log FOR ALL USING (false) WITH CHECK (false);

-- ---------------------------------------------------------------------------
-- 085 — maintenance mode audit keys
-- ---------------------------------------------------------------------------

INSERT INTO site_settings (key, value) VALUES
  ('maintenance_mode', 'false'),
  (
    'maintenance_message',
    'We are performing scheduled maintenance. Some features may be temporarily unavailable.'
  ),
  ('maintenance_enabled_by', ''),
  ('maintenance_enabled_at', ''),
  ('maintenance_disabled_by', ''),
  ('maintenance_disabled_at', ''),
  ('maintenance_updated_by', ''),
  ('maintenance_updated_at', '')
ON CONFLICT (key) DO NOTHING;

-- ---------------------------------------------------------------------------
-- Reload PostgREST schema cache so new columns/tables are visible immediately
-- ---------------------------------------------------------------------------

NOTIFY pgrst, 'reload schema';
