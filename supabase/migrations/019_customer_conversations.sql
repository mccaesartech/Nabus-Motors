-- Two-way customer ↔ staff conversations (threaded chat)

-- 1. Ensure profiles.registration_id exists BEFORE any backfill (self-contained; safe if 013/018 were skipped)
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS registration_id TEXT;

CREATE SEQUENCE IF NOT EXISTS customer_registration_seq START 1;

CREATE OR REPLACE FUNCTION public.generate_registration_id()
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
  year_part TEXT := to_char(NOW(), 'YYYY');
  seq_num INTEGER;
BEGIN
  seq_num := nextval('customer_registration_seq');
  RETURN 'TG-' || year_part || '-' || lpad(seq_num::text, 5, '0');
END;
$$;

UPDATE profiles
SET registration_id = generate_registration_id()
WHERE registration_id IS NULL;

-- 2. Conversation tables
CREATE TABLE IF NOT EXISTS customer_conversations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  customer_name TEXT NOT NULL,
  customer_email TEXT NOT NULL,
  registration_id TEXT,
  subject TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'general',
  status TEXT NOT NULL DEFAULT 'open',
  created_by TEXT NOT NULL DEFAULT 'customer',
  customer_last_read_at TIMESTAMPTZ,
  staff_last_read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT customer_conversations_category_check
    CHECK (category IN ('general', 'pre-order', 'financing', 'processing')),
  CONSTRAINT customer_conversations_status_check
    CHECK (status IN ('new', 'open', 'replied', 'closed')),
  CONSTRAINT customer_conversations_created_by_check
    CHECK (created_by IN ('customer', 'staff'))
);

CREATE INDEX IF NOT EXISTS idx_customer_conversations_user
  ON customer_conversations(user_id, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_customer_conversations_status
  ON customer_conversations(status, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_customer_conversations_updated
  ON customer_conversations(updated_at DESC);

CREATE TABLE IF NOT EXISTS customer_conversation_messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  conversation_id UUID NOT NULL REFERENCES customer_conversations(id) ON DELETE CASCADE,
  sender_type TEXT NOT NULL,
  sender_user_id UUID REFERENCES platform_users(id) ON DELETE SET NULL,
  sender_is_owner BOOLEAN NOT NULL DEFAULT false,
  sender_name TEXT NOT NULL,
  body TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT customer_conversation_messages_sender_type_check
    CHECK (sender_type IN ('customer', 'staff')),
  CONSTRAINT customer_conversation_messages_staff_sender_check
    CHECK (
      sender_type = 'customer'
      OR sender_is_owner = true
      OR sender_user_id IS NOT NULL
    )
);

CREATE INDEX IF NOT EXISTS idx_customer_conversation_messages_thread
  ON customer_conversation_messages(conversation_id, created_at ASC);

-- 3. Migrate legacy single-reply tickets into threaded conversations (only if customer_messages exists)
DO $$
BEGIN
  IF to_regclass('public.customer_messages') IS NOT NULL THEN
    EXECUTE $migrate$
      INSERT INTO customer_conversations (
        id,
        user_id,
        customer_name,
        customer_email,
        subject,
        category,
        status,
        created_by,
        staff_last_read_at,
        created_at,
        updated_at
      )
      SELECT
        cm.id,
        cm.user_id,
        cm.name,
        cm.email,
        cm.subject,
        cm.category,
        cm.status,
        'customer',
        CASE WHEN cm.admin_reply IS NOT NULL AND cm.admin_reply <> '' THEN cm.updated_at ELSE NULL END,
        cm.created_at,
        cm.updated_at
      FROM customer_messages cm
      WHERE NOT EXISTS (
        SELECT 1 FROM customer_conversations cc WHERE cc.id = cm.id
      )
    $migrate$;

    EXECUTE $migrate$
      INSERT INTO customer_conversation_messages (
        conversation_id,
        sender_type,
        sender_name,
        body,
        created_at
      )
      SELECT
        cm.id,
        'customer',
        cm.name,
        cm.body,
        cm.created_at
      FROM customer_messages cm
      WHERE NOT EXISTS (
        SELECT 1
        FROM customer_conversation_messages ccm
        WHERE ccm.conversation_id = cm.id AND ccm.sender_type = 'customer'
      )
    $migrate$;

    EXECUTE $migrate$
      INSERT INTO customer_conversation_messages (
        conversation_id,
        sender_type,
        sender_is_owner,
        sender_name,
        body,
        created_at
      )
      SELECT
        cm.id,
        'staff',
        true,
        'Team',
        cm.admin_reply,
        cm.updated_at
      FROM customer_messages cm
      WHERE cm.admin_reply IS NOT NULL
        AND cm.admin_reply <> ''
        AND NOT EXISTS (
          SELECT 1
          FROM customer_conversation_messages ccm
          WHERE ccm.conversation_id = cm.id AND ccm.sender_type = 'staff'
        )
    $migrate$;
  END IF;
END $$;

-- 4. Backfill customer_conversations.registration_id from profiles
UPDATE customer_conversations cc
SET registration_id = p.registration_id
FROM profiles p
WHERE p.id = cc.user_id
  AND cc.registration_id IS NULL
  AND p.registration_id IS NOT NULL;

-- 5. RLS, trigger, realtime
ALTER TABLE customer_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer_conversation_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role manages customer_conversations" ON customer_conversations;
CREATE POLICY "Service role manages customer_conversations"
  ON customer_conversations FOR ALL USING (false) WITH CHECK (false);

DROP POLICY IF EXISTS "Service role manages customer_conversation_messages" ON customer_conversation_messages;
CREATE POLICY "Service role manages customer_conversation_messages"
  ON customer_conversation_messages FOR ALL USING (false) WITH CHECK (false);

DROP POLICY IF EXISTS "Customers view own conversations" ON customer_conversations;
CREATE POLICY "Customers view own conversations"
  ON customer_conversations FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Customers view own conversation messages" ON customer_conversation_messages;
CREATE POLICY "Customers view own conversation messages"
  ON customer_conversation_messages FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM customer_conversations c
      WHERE c.id = conversation_id AND c.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Customers insert own conversation messages" ON customer_conversation_messages;
CREATE POLICY "Customers insert own conversation messages"
  ON customer_conversation_messages FOR INSERT
  WITH CHECK (
    sender_type = 'customer'
    AND EXISTS (
      SELECT 1 FROM customer_conversations c
      WHERE c.id = conversation_id AND c.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Customers insert own conversations" ON customer_conversations;
CREATE POLICY "Customers insert own conversations"
  ON customer_conversations FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP TRIGGER IF EXISTS trg_customer_conversations_updated ON customer_conversations;
CREATE TRIGGER trg_customer_conversations_updated
  BEFORE UPDATE ON customer_conversations
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'customer_conversation_messages'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE customer_conversation_messages;
  END IF;
END $$;
