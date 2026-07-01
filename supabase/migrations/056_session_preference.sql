-- Optional profile field for customer sign-in persistence preference
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS session_preference TEXT;

COMMENT ON COLUMN profiles.session_preference IS
  'Customer sign-in preference: stay_signed_in, ask_each_time, or no_save';
