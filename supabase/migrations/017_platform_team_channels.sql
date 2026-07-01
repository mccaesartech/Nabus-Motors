-- All-staff channel and custom staff groups for platform team chat

ALTER TABLE platform_conversations
  ADD COLUMN IF NOT EXISTS channel_type TEXT NOT NULL DEFAULT 'direct'
    CHECK (channel_type IN ('direct', 'all_staff', 'group')),
  ADD COLUMN IF NOT EXISTS name TEXT,
  ADD COLUMN IF NOT EXISTS created_by_user_id UUID REFERENCES platform_users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS created_by_is_owner BOOLEAN NOT NULL DEFAULT false;

CREATE UNIQUE INDEX IF NOT EXISTS idx_platform_conversations_all_staff
  ON platform_conversations ((true))
  WHERE channel_type = 'all_staff';

CREATE INDEX IF NOT EXISTS idx_platform_conversations_channel_type
  ON platform_conversations(channel_type, updated_at DESC);

-- Seed the company-wide all-staff channel
INSERT INTO platform_conversations (channel_type, name)
SELECT 'all_staff', 'All Staff'
WHERE NOT EXISTS (
  SELECT 1 FROM platform_conversations WHERE channel_type = 'all_staff'
);
