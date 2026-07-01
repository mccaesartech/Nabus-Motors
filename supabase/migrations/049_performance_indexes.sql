-- Speed up public inventory, dashboard stats, and cart lookups.

CREATE INDEX IF NOT EXISTS idx_vehicles_status_created
  ON vehicles(status, created_at DESC)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_vehicles_slug
  ON vehicles(slug)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_vehicles_approval_status
  ON vehicles(approval_status)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_preorder_inquiries_status_created
  ON preorder_inquiries(status, created_at DESC)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_preorder_inquiries_payment_status
  ON preorder_inquiries(payment_status)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_admin_notifications_unread
  ON admin_notifications(created_at DESC)
  WHERE read_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_vehicle_inquiries_status
  ON vehicle_inquiries(status, created_at DESC)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_contact_inquiries_status
  ON contact_inquiries(status, created_at DESC)
  WHERE deleted_at IS NULL;
