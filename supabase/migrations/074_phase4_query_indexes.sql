-- Phase 4: indexes for observed list/detail query shapes.
-- Apply in a staging/maintenance window first and validate with EXPLAIN
-- (ANALYZE, BUFFERS). Index creation can lock writes on large tables.
--
-- Reversal:
--   DROP INDEX IF EXISTS idx_vehicles_public_created;
--   DROP INDEX IF EXISTS idx_profiles_active_created;
--   DROP INDEX IF EXISTS idx_parts_orders_active_created;
--   DROP INDEX IF EXISTS idx_contact_inquiries_active_created;
--   DROP INDEX IF EXISTS idx_vehicle_inquiries_active_created;
--   DROP INDEX IF EXISTS idx_finance_applications_active_created;
--   DROP INDEX IF EXISTS idx_appraisal_requests_active_created;
--   DROP INDEX IF EXISTS idx_preorder_user_active_created;
--   DROP INDEX IF EXISTS idx_freight_quotes_user_created;
--   DROP INDEX IF EXISTS idx_shipment_tracking_user_created;

CREATE INDEX IF NOT EXISTS idx_vehicles_public_created
  ON vehicles (approval_status, status, created_at DESC)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_profiles_active_created
  ON profiles (created_at DESC)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_parts_orders_active_created
  ON parts_orders (created_at DESC)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_contact_inquiries_active_created
  ON contact_inquiries (created_at DESC)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_vehicle_inquiries_active_created
  ON vehicle_inquiries (created_at DESC)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_finance_applications_active_created
  ON finance_applications (created_at DESC)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_appraisal_requests_active_created
  ON appraisal_requests (created_at DESC)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_preorder_user_active_created
  ON preorder_inquiries (user_id, created_at DESC)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_freight_quotes_user_created
  ON freight_quote_requests (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_shipment_tracking_user_created
  ON shipment_tracking (user_id, created_at DESC);
