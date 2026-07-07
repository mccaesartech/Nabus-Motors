-- In-app customer notifications (badge on My Account, account page inbox)

CREATE TABLE IF NOT EXISTS customer_notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  link TEXT,
  source_table TEXT,
  source_id TEXT,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  metadata JSONB DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_customer_notifications_user_unread
  ON customer_notifications(user_id, created_at DESC)
  WHERE read_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_customer_notifications_user_created
  ON customer_notifications(user_id, created_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS idx_customer_notifications_dedupe
  ON customer_notifications(user_id, type, source_table, source_id)
  WHERE source_id IS NOT NULL AND source_table IS NOT NULL;

ALTER TABLE customer_notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "No public access to customer notifications" ON customer_notifications;
CREATE POLICY "No public access to customer notifications"
  ON customer_notifications FOR ALL USING (false) WITH CHECK (false);
