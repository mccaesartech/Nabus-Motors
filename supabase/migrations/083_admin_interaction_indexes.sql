-- Admin interaction performance indexes (2026-07-28 audit).
-- DO NOT apply remotely from CI/agent — run in Supabase SQL Editor after review.
--
-- Evidence: open-status counts and lead pipeline filters on finance/appraisal lack
-- status-leading indexes (unlike contact/vehicle/preorder in 049_performance_indexes).
-- Recipient-scoped admin_notifications lists filter by recipient + created_at.
--
-- Soft-delete: finance_applications / appraisal_requests / vehicles get deleted_at
-- from 054_platform_trash. admin_notifications gets it from 080 — ensure columns
-- here so this script is safe if 080 was never applied on the remote DB.
--
-- Reversal:
--   DROP INDEX IF EXISTS idx_finance_applications_status_created;
--   DROP INDEX IF EXISTS idx_appraisal_requests_status_created;
--   DROP INDEX IF EXISTS idx_admin_notifications_recipient_user_created;
--   DROP INDEX IF EXISTS idx_admin_notifications_recipient_owner_created;
--   DROP INDEX IF EXISTS idx_vehicles_available_stock;

-- Ensure soft-delete columns exist before partial indexes that filter on them.
ALTER TABLE admin_notifications
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS deleted_by_user_id UUID REFERENCES platform_users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_admin_notifications_deleted_at
  ON admin_notifications (deleted_at)
  WHERE deleted_at IS NOT NULL;

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

-- Speeds countAvailableVehicleUnits / fleet stock scans (status=available).
CREATE INDEX IF NOT EXISTS idx_vehicles_available_stock
  ON vehicles (status)
  INCLUDE (stock_quantity)
  WHERE deleted_at IS NULL AND status = 'available';

-- Optional follow-up (manual): replace Node-side stock sum with
--   SELECT COALESCE(SUM(COALESCE(stock_quantity, 1)), 0) FROM vehicles
--   WHERE deleted_at IS NULL AND status = 'available';
-- via a SECURITY DEFINER RPC if fleet size grows past a few hundred rows.
