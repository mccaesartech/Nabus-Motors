-- Unified platform recycle bin: audit trail + soft-delete columns on key entities.

CREATE TABLE IF NOT EXISTS platform_trash (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  entity_label TEXT NOT NULL,
  snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
  deleted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_by_user_id UUID REFERENCES platform_users(id) ON DELETE SET NULL,
  deleted_by_name TEXT,
  deleted_by_email TEXT,
  restored_at TIMESTAMPTZ,
  permanently_deleted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_platform_trash_active
  ON platform_trash (deleted_at DESC)
  WHERE restored_at IS NULL AND permanently_deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_platform_trash_entity_type
  ON platform_trash (entity_type)
  WHERE restored_at IS NULL AND permanently_deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_platform_trash_deleted_by
  ON platform_trash (deleted_by_user_id)
  WHERE restored_at IS NULL AND permanently_deleted_at IS NULL;

-- Soft-delete columns (nullable = active record)
ALTER TABLE vehicles
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS deleted_by_user_id UUID REFERENCES platform_users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_vehicles_deleted_at ON vehicles (deleted_at)
  WHERE deleted_at IS NOT NULL;

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
  ADD COLUMN IF NOT EXISTS deleted_by_user_id UUID REFERENCES platform_users(id) ON DELETE SET NULL;

ALTER TABLE platform_trash ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role manages platform trash" ON platform_trash;
CREATE POLICY "Service role manages platform trash"
  ON platform_trash FOR ALL USING (false) WITH CHECK (false);
