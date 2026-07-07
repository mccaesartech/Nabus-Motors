-- Support Google OAuth user metadata (name / full_name) when creating profiles.
CREATE OR REPLACE FUNCTION public.handle_new_customer()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  full_name TEXT := COALESCE(
    NEW.raw_user_meta_data->>'full_name',
    NEW.raw_user_meta_data->>'name',
    ''
  );
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
    first_name = COALESCE(NULLIF(EXCLUDED.first_name, ''), profiles.first_name),
    last_name = COALESCE(EXCLUDED.last_name, profiles.last_name),
    phone = COALESCE(EXCLUDED.phone, profiles.phone),
    email = COALESCE(EXCLUDED.email, profiles.email),
    registration_id = COALESCE(profiles.registration_id, generate_registration_id()),
    updated_at = NOW();
  RETURN NEW;
END;
$$;
