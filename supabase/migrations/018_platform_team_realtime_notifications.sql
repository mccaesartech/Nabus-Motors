-- Team chat realtime publication + per-recipient admin notifications

-- Target notifications to specific platform users (owner or staff). NULL recipient = global (legacy).
ALTER TABLE admin_notifications
  ADD COLUMN IF NOT EXISTS recipient_user_id UUID REFERENCES platform_users(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS recipient_is_owner BOOLEAN NOT NULL DEFAULT false;

DROP INDEX IF EXISTS idx_admin_notifications_source;
CREATE UNIQUE INDEX IF NOT EXISTS idx_admin_notifications_source_recipient
  ON admin_notifications (
    source_table,
    source_id,
    COALESCE(recipient_user_id::text, ''),
    recipient_is_owner
  )
  WHERE source_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_admin_notifications_recipient_user
  ON admin_notifications (recipient_user_id, created_at DESC)
  WHERE recipient_user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_admin_notifications_recipient_owner
  ON admin_notifications (created_at DESC)
  WHERE recipient_is_owner = true;

-- Enable Supabase Realtime on team messages and notifications (idempotent).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'platform_messages'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE platform_messages;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'admin_notifications'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE admin_notifications;
  END IF;
END $$;
