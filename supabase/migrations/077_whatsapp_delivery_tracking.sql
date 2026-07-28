-- WhatsApp delivery tracking, webhook replay protection, and API settings seeds.
-- Idempotent. Service-role only (RLS deny-all for anon/authenticated).

-- ---------------------------------------------------------------------------
-- notification_log: delivery tracking columns + wider statuses
-- ---------------------------------------------------------------------------

ALTER TABLE notification_log
  ADD COLUMN IF NOT EXISTS provider TEXT,
  ADD COLUMN IF NOT EXISTS provider_message_id TEXT,
  ADD COLUMN IF NOT EXISTS idempotency_key TEXT,
  ADD COLUMN IF NOT EXISTS retry_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS next_retry_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS delivered_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS read_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS error_code TEXT,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

ALTER TABLE notification_log DROP CONSTRAINT IF EXISTS notification_log_status_check;
ALTER TABLE notification_log ADD CONSTRAINT notification_log_status_check
  CHECK (status IN (
    'queued',
    'sent',
    'delivered',
    'read',
    'failed',
    'skipped',
    'deferred',
    'undeliverable'
  ));

CREATE UNIQUE INDEX IF NOT EXISTS idx_notification_log_idempotency
  ON notification_log (idempotency_key)
  WHERE idempotency_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_notification_log_provider_message
  ON notification_log (provider_message_id)
  WHERE provider_message_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_notification_log_retry
  ON notification_log (next_retry_at)
  WHERE next_retry_at IS NOT NULL AND status IN ('queued', 'failed');

CREATE INDEX IF NOT EXISTS idx_notification_log_status_created
  ON notification_log (status, created_at DESC);

-- ---------------------------------------------------------------------------
-- whatsapp_webhook_events: Meta webhook replay protection
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS whatsapp_webhook_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_id TEXT NOT NULL,
  event_type TEXT,
  payload JSONB,
  processed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_whatsapp_webhook_events_event_id
  ON whatsapp_webhook_events (event_id);

CREATE INDEX IF NOT EXISTS idx_whatsapp_webhook_events_created
  ON whatsapp_webhook_events (created_at DESC);

ALTER TABLE whatsapp_webhook_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role manages whatsapp_webhook_events" ON whatsapp_webhook_events;
CREATE POLICY "Service role manages whatsapp_webhook_events"
  ON whatsapp_webhook_events FOR ALL USING (false) WITH CHECK (false);

-- ---------------------------------------------------------------------------
-- site_settings seeds (VERIFY_TOKEN / APP_SECRET stay env-only)
-- ---------------------------------------------------------------------------

INSERT INTO site_settings (key, value) VALUES
  ('whatsapp_enabled', 'true'),
  ('whatsapp_business_account_id', ''),
  ('whatsapp_default_country', 'GH'),
  ('notify_team_whatsapp_enabled', 'true'),
  ('whatsapp_template_password_reset', 'password_reset'),
  ('whatsapp_template_team_invite', 'team_invite'),
  ('whatsapp_template_team_welcome', 'team_welcome'),
  ('whatsapp_template_team_role_changed', 'team_role_changed'),
  ('whatsapp_template_team_password_set', 'team_password_set'),
  ('whatsapp_template_language', 'en')
ON CONFLICT (key) DO NOTHING;
