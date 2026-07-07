-- Customer vehicle preference profile for cross-device recommendations
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS vehicle_preferences JSONB;

COMMENT ON COLUMN profiles.vehicle_preferences IS
  'Weighted vehicle engagement profile (make, body type, fuel, price band, origin) for personalized suggestions';
