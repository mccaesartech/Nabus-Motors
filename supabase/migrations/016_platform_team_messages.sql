-- Internal team messaging between platform users (owner, managers, staff)

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS platform_conversations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_platform_conversations_updated
  ON platform_conversations(updated_at DESC);

CREATE TABLE IF NOT EXISTS platform_conversation_members (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  conversation_id UUID NOT NULL REFERENCES platform_conversations(id) ON DELETE CASCADE,
  user_id UUID REFERENCES platform_users(id) ON DELETE CASCADE,
  is_owner BOOLEAN NOT NULL DEFAULT false,
  last_read_at TIMESTAMPTZ,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT platform_conversation_members_participant_check
    CHECK (is_owner = true OR user_id IS NOT NULL),
  CONSTRAINT platform_conversation_members_user_unique
    UNIQUE (conversation_id, user_id)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_platform_conversation_members_owner
  ON platform_conversation_members(conversation_id)
  WHERE is_owner = true;

CREATE INDEX IF NOT EXISTS idx_platform_conversation_members_user
  ON platform_conversation_members(user_id)
  WHERE user_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS platform_messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  conversation_id UUID NOT NULL REFERENCES platform_conversations(id) ON DELETE CASCADE,
  sender_user_id UUID REFERENCES platform_users(id) ON DELETE SET NULL,
  sender_is_owner BOOLEAN NOT NULL DEFAULT false,
  sender_name TEXT NOT NULL,
  sender_email TEXT NOT NULL,
  body TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT platform_messages_sender_check
    CHECK (sender_is_owner = true OR sender_user_id IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS idx_platform_messages_conversation
  ON platform_messages(conversation_id, created_at ASC);

ALTER TABLE platform_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE platform_conversation_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE platform_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role manages platform_conversations" ON platform_conversations;
CREATE POLICY "Service role manages platform_conversations"
  ON platform_conversations FOR ALL USING (false) WITH CHECK (false);

DROP POLICY IF EXISTS "Service role manages platform_conversation_members" ON platform_conversation_members;
CREATE POLICY "Service role manages platform_conversation_members"
  ON platform_conversation_members FOR ALL USING (false) WITH CHECK (false);

DROP POLICY IF EXISTS "Service role manages platform_messages" ON platform_messages;
CREATE POLICY "Service role manages platform_messages"
  ON platform_messages FOR ALL USING (false) WITH CHECK (false);
