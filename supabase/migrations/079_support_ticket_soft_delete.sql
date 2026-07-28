-- Soft-delete for customer support tickets (Platform → Messages).
-- Tickets move to platform_trash and can be restored.

ALTER TABLE customer_conversations
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS deleted_by_user_id UUID REFERENCES platform_users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_customer_conversations_deleted_at
  ON customer_conversations (deleted_at)
  WHERE deleted_at IS NOT NULL;
