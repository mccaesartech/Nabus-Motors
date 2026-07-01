-- Preserve message history when platform users are deleted.
-- ON DELETE SET NULL clears sender_user_id, which violated sender check constraints
-- for staff messages (sender_is_owner = false AND sender_user_id IS NULL).

ALTER TABLE platform_messages
  ADD COLUMN IF NOT EXISTS sender_anonymized BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE customer_conversation_messages
  ADD COLUMN IF NOT EXISTS sender_anonymized BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE platform_messages
  DROP CONSTRAINT IF EXISTS platform_messages_sender_check;

ALTER TABLE platform_messages
  ADD CONSTRAINT platform_messages_sender_check
  CHECK (
    sender_is_owner = true
    OR sender_user_id IS NOT NULL
    OR sender_anonymized = true
  );

ALTER TABLE customer_conversation_messages
  DROP CONSTRAINT IF EXISTS customer_conversation_messages_staff_sender_check;

ALTER TABLE customer_conversation_messages
  ADD CONSTRAINT customer_conversation_messages_staff_sender_check
  CHECK (
    sender_type = 'customer'
    OR sender_is_owner = true
    OR sender_user_id IS NOT NULL
    OR sender_anonymized = true
  );

CREATE OR REPLACE FUNCTION anonymize_platform_user_messages()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE platform_messages
  SET sender_anonymized = true
  WHERE sender_user_id = OLD.id;

  UPDATE customer_conversation_messages
  SET sender_anonymized = true
  WHERE sender_user_id = OLD.id;

  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS anonymize_messages_before_platform_user_delete ON platform_users;

CREATE TRIGGER anonymize_messages_before_platform_user_delete
  BEFORE DELETE ON platform_users
  FOR EACH ROW
  EXECUTE FUNCTION anonymize_platform_user_messages();
