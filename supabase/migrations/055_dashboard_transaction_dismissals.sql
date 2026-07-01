-- Hide sold/reserved/pre-order rows from the dashboard "Recent transactions" widget
-- without soft-deleting the vehicle from inventory.

CREATE TABLE IF NOT EXISTS dashboard_transaction_dismissals (
  vehicle_id UUID PRIMARY KEY REFERENCES vehicles(id) ON DELETE CASCADE,
  dismissed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  dismissed_by_user_id UUID REFERENCES platform_users(id) ON DELETE SET NULL,
  dismissed_by_name TEXT,
  dismissed_by_email TEXT
);

CREATE INDEX IF NOT EXISTS idx_dashboard_transaction_dismissals_dismissed_at
  ON dashboard_transaction_dismissals (dismissed_at DESC);

ALTER TABLE dashboard_transaction_dismissals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role manages dashboard dismissals" ON dashboard_transaction_dismissals;
CREATE POLICY "Service role manages dashboard dismissals"
  ON dashboard_transaction_dismissals FOR ALL USING (false) WITH CHECK (false);
