-- Customer authentication: profiles trigger + customer_messages

-- Allow new signups to create their profile row
DROP POLICY IF EXISTS "Users can insert own profile" ON profiles;
CREATE POLICY "Users can insert own profile"
  ON profiles FOR INSERT WITH CHECK (auth.uid() = id);

-- Auto-create profile when a customer registers via Supabase Auth
CREATE OR REPLACE FUNCTION public.handle_new_customer()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  full_name TEXT := COALESCE(NEW.raw_user_meta_data->>'full_name', '');
  space_pos INT;
BEGIN
  space_pos := position(' ' IN full_name);
  INSERT INTO public.profiles (id, first_name, last_name, phone)
  VALUES (
    NEW.id,
    CASE WHEN space_pos > 0 THEN left(full_name, space_pos - 1) ELSE full_name END,
    CASE WHEN space_pos > 0 THEN trim(substring(full_name FROM space_pos + 1)) ELSE NULL END,
    NEW.raw_user_meta_data->>'phone'
  )
  ON CONFLICT (id) DO UPDATE SET
    first_name = EXCLUDED.first_name,
    last_name = EXCLUDED.last_name,
    phone = COALESCE(EXCLUDED.phone, profiles.phone),
    updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_customer_created ON auth.users;
CREATE TRIGGER on_auth_customer_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_customer();

-- Customer ↔ team messaging
CREATE TABLE IF NOT EXISTS customer_messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  name TEXT NOT NULL,
  subject TEXT NOT NULL,
  body TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'general',
  status TEXT NOT NULL DEFAULT 'new',
  admin_reply TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE customer_messages
  DROP CONSTRAINT IF EXISTS customer_messages_category_check;

ALTER TABLE customer_messages
  ADD CONSTRAINT customer_messages_category_check
  CHECK (category IN ('general', 'pre-order', 'financing', 'processing'));

ALTER TABLE customer_messages
  DROP CONSTRAINT IF EXISTS customer_messages_status_check;

ALTER TABLE customer_messages
  ADD CONSTRAINT customer_messages_status_check
  CHECK (status IN ('new', 'open', 'replied', 'closed'));

CREATE INDEX IF NOT EXISTS idx_customer_messages_user ON customer_messages(user_id);
CREATE INDEX IF NOT EXISTS idx_customer_messages_status ON customer_messages(status);
CREATE INDEX IF NOT EXISTS idx_customer_messages_created ON customer_messages(created_at DESC);

ALTER TABLE customer_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own messages" ON customer_messages;
CREATE POLICY "Users can view own messages"
  ON customer_messages FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own messages" ON customer_messages;
CREATE POLICY "Users can insert own messages"
  ON customer_messages FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP TRIGGER IF EXISTS trg_customer_messages_updated ON customer_messages;
CREATE TRIGGER trg_customer_messages_updated
  BEFORE UPDATE ON customer_messages
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
