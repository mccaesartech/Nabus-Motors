-- Speed up platform email history queries (channel = email).

CREATE INDEX IF NOT EXISTS idx_notification_log_email_created
  ON notification_log(created_at DESC)
  WHERE channel = 'email';

CREATE INDEX IF NOT EXISTS idx_notification_log_email_status
  ON notification_log(status, created_at DESC)
  WHERE channel = 'email';
