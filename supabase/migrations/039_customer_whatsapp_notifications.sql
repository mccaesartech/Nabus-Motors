-- Customer WhatsApp notification preferences and delivery log.

ALTER TABLE freight_quote_requests
  ADD COLUMN IF NOT EXISTS whatsapp_opt_in BOOLEAN DEFAULT NULL;

ALTER TABLE preorder_inquiries
  ADD COLUMN IF NOT EXISTS whatsapp_opt_in BOOLEAN DEFAULT NULL;

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS whatsapp_opt_in BOOLEAN DEFAULT NULL;

CREATE TABLE IF NOT EXISTS notification_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  source_table TEXT,
  source_id TEXT,
  template TEXT NOT NULL,
  channel TEXT NOT NULL CHECK (channel IN ('whatsapp', 'email')),
  status TEXT NOT NULL CHECK (status IN ('sent', 'failed', 'skipped', 'deferred')),
  recipient TEXT NOT NULL,
  detail TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notification_log_source
  ON notification_log(source_table, source_id);

CREATE INDEX IF NOT EXISTS idx_notification_log_created
  ON notification_log(created_at DESC);

ALTER TABLE notification_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role manages notification_log" ON notification_log;
CREATE POLICY "Service role manages notification_log"
  ON notification_log FOR ALL USING (false) WITH CHECK (false);

-- Default Ghana mobile numbers to WhatsApp opt-in
UPDATE freight_quote_requests
SET whatsapp_opt_in = TRUE
WHERE whatsapp_opt_in IS NULL
  AND phone IS NOT NULL
  AND phone ~ '^(\+?233|0)(20|23|24|25|26|27|28|50|53|54|55|56|57|59)';

UPDATE preorder_inquiries
SET whatsapp_opt_in = TRUE
WHERE whatsapp_opt_in IS NULL
  AND phone IS NOT NULL
  AND phone ~ '^(\+?233|0)(20|23|24|25|26|27|28|50|53|54|55|56|57|59)';
