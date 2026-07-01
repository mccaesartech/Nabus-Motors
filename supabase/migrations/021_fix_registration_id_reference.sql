-- Fix partial 019 failure: profiles.registration_id missing when backfill ran.
-- Idempotent — safe to re-run after a failed 019_customer_conversations migration.
--
-- If customer_conversations does NOT exist (019 rolled back entirely), run
-- supabase/migrations/RUN_019_COMPLETE.sql in the Supabase SQL Editor first.

-- Ensure profiles has registration_id (from 013/018)
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

-- Steps below require customer_conversations (skip if 019 rolled back — use RUN_019_COMPLETE.sql)
DO $$
BEGIN
  IF to_regclass('public.customer_conversations') IS NULL THEN
    RAISE NOTICE '021 skipped: customer_conversations missing. Run RUN_019_COMPLETE.sql first.';
    RETURN;
  END IF;

  UPDATE customer_conversations cc
  SET registration_id = p.registration_id
  FROM profiles p
  WHERE p.id = cc.user_id
    AND cc.registration_id IS NULL
    AND p.registration_id IS NOT NULL;

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

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'customer_conversation_messages'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE customer_conversation_messages;
  END IF;
END $$;
