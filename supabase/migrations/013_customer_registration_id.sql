-- Customer registration ID + multi-car pre-order linking

-- ─── Registration ID on profiles ─────────────────────────────────────────────
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

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS registration_id TEXT,
  ADD COLUMN IF NOT EXISTS email TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_profiles_registration_id
  ON profiles(registration_id)
  WHERE registration_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_profiles_email_lower
  ON profiles(lower(email));

-- Backfill registration IDs for existing profiles
UPDATE profiles
SET registration_id = generate_registration_id()
WHERE registration_id IS NULL;

-- Backfill email from auth.users
UPDATE profiles p
SET email = u.email
FROM auth.users u
WHERE p.id = u.id AND (p.email IS NULL OR p.email = '');

ALTER TABLE profiles
  ALTER COLUMN registration_id SET NOT NULL;

-- Auto-create profile with registration ID when a customer registers
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
  INSERT INTO public.profiles (id, first_name, last_name, phone, email, registration_id)
  VALUES (
    NEW.id,
    CASE WHEN space_pos > 0 THEN left(full_name, space_pos - 1) ELSE full_name END,
    CASE WHEN space_pos > 0 THEN trim(substring(full_name FROM space_pos + 1)) ELSE NULL END,
    NEW.raw_user_meta_data->>'phone',
    NEW.email,
    generate_registration_id()
  )
  ON CONFLICT (id) DO UPDATE SET
    first_name = EXCLUDED.first_name,
    last_name = EXCLUDED.last_name,
    phone = COALESCE(EXCLUDED.phone, profiles.phone),
    email = COALESCE(EXCLUDED.email, profiles.email),
    registration_id = COALESCE(profiles.registration_id, generate_registration_id()),
    updated_at = NOW();
  RETURN NEW;
END;
$$;

-- ─── Link pre-orders to customer accounts ────────────────────────────────────
ALTER TABLE preorder_inquiries
  ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS customer_registration_id TEXT;

CREATE INDEX IF NOT EXISTS idx_preorder_inquiries_user
  ON preorder_inquiries(user_id);

CREATE INDEX IF NOT EXISTS idx_preorder_inquiries_registration_id
  ON preorder_inquiries(customer_registration_id);

-- Customers can view their own pre-orders when logged in
DROP POLICY IF EXISTS "Users can view own preorder inquiries" ON preorder_inquiries;
CREATE POLICY "Users can view own preorder inquiries"
  ON preorder_inquiries FOR SELECT
  USING (
    auth.uid() = user_id
    OR lower(email) = lower(COALESCE(auth.jwt() ->> 'email', ''))
  );
