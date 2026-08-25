-- =============================================================================
-- 091 — Customer profile enrichment + registration ID backfill + avatars
-- =============================================================================
-- Adds optional profile fields, ensures every profile has a unique registration_id,
-- and creates a public-read storage bucket for customer avatar uploads.
-- Safe to re-run: idempotent DDL / backfill.
-- =============================================================================

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

-- Atomically assign a registration ID when missing (used by app sync paths).
CREATE OR REPLACE FUNCTION public.ensure_customer_registration_id(p_user_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_id TEXT;
  new_id TEXT;
BEGIN
  IF p_user_id IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT registration_id INTO current_id
  FROM public.profiles
  WHERE id = p_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  IF current_id IS NOT NULL AND btrim(current_id) <> '' THEN
    RETURN current_id;
  END IF;

  new_id := public.generate_registration_id();

  UPDATE public.profiles
  SET
    registration_id = new_id,
    updated_at = NOW()
  WHERE id = p_user_id
    AND (registration_id IS NULL OR btrim(registration_id) = '');

  SELECT registration_id INTO current_id
  FROM public.profiles
  WHERE id = p_user_id;

  RETURN current_id;
END;
$$;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS avatar_url TEXT,
  ADD COLUMN IF NOT EXISTS address_line TEXT,
  ADD COLUMN IF NOT EXISTS city TEXT,
  ADD COLUMN IF NOT EXISTS country TEXT,
  ADD COLUMN IF NOT EXISTS preferred_contact TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'profiles_preferred_contact_check'
      AND conrelid = 'public.profiles'::regclass
  ) THEN
    ALTER TABLE public.profiles
      ADD CONSTRAINT profiles_preferred_contact_check
      CHECK (
        preferred_contact IS NULL
        OR preferred_contact IN ('email', 'phone', 'whatsapp')
      );
  END IF;
END
$$;

COMMENT ON COLUMN public.profiles.avatar_url IS
  'Customer-uploaded avatar public URL (preferred over OAuth picture).';
COMMENT ON COLUMN public.profiles.preferred_contact IS
  'Preferred contact channel: email | phone | whatsapp.';

CREATE UNIQUE INDEX IF NOT EXISTS idx_profiles_registration_id
  ON public.profiles (registration_id)
  WHERE registration_id IS NOT NULL;

-- Backfill any existing profiles missing a registration number (collision-safe via sequence).
UPDATE public.profiles
SET
  registration_id = public.generate_registration_id(),
  updated_at = NOW()
WHERE registration_id IS NULL OR btrim(registration_id) = '';

-- ---------------------------------------------------------------------------
-- Avatar storage bucket (public read). Service role uploads bypass RLS.
-- If storage DDL fails (managed ownership), create bucket "customer-avatars"
-- in Supabase Dashboard -> Storage with public read and image MIME types.
-- ---------------------------------------------------------------------------

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'customer-avatars',
  'customer-avatars',
  true,
  2097152,
  ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "Public read customer avatars" ON storage.objects;
CREATE POLICY "Public read customer avatars"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'customer-avatars');

-- Writes are server-only via the service role (bypasses RLS). Do not add
-- INSERT/UPDATE/DELETE policies for anon/authenticated — permissive
-- bucket checks would let any client upload with the public anon key.
DROP POLICY IF EXISTS "Service role upload customer avatars" ON storage.objects;
DROP POLICY IF EXISTS "Service role update customer avatars" ON storage.objects;
DROP POLICY IF EXISTS "Service role delete customer avatars" ON storage.objects;
