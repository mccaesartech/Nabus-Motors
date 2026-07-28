-- Soft-delete for persisted admin notifications (Platform → Notifications → Trash).

ALTER TABLE admin_notifications
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS deleted_by_user_id UUID REFERENCES platform_users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_admin_notifications_deleted_at
  ON admin_notifications (deleted_at)
  WHERE deleted_at IS NOT NULL;
