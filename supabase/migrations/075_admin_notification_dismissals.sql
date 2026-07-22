-- Persist read/dismiss state for synthetic admin notifications (low-stock, delivery log alerts).

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
