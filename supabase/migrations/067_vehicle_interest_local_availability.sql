-- Track customer interest on pre-order vehicles and local availability notifications

ALTER TABLE vehicles
  ADD COLUMN IF NOT EXISTS available_locally BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE vehicles
  ADD COLUMN IF NOT EXISTS local_availability_at TIMESTAMPTZ;

COMMENT ON COLUMN vehicles.available_locally IS
  'Admin flag: vehicle is now in Ghana and can be bought without shipping';
COMMENT ON COLUMN vehicles.local_availability_at IS
  'When available_locally was last enabled — used to dedupe availability notifications';

CREATE TABLE IF NOT EXISTS vehicle_interest (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id TEXT NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  email TEXT,
  phone TEXT,
  activity_type TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_vehicle_interest_vehicle_id
  ON vehicle_interest(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_vehicle_interest_email
  ON vehicle_interest(email)
  WHERE email IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_vehicle_interest_user_id
  ON vehicle_interest(user_id)
  WHERE user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_vehicle_interest_created
  ON vehicle_interest(created_at DESC);

COMMENT ON TABLE vehicle_interest IS
  'Customer engagement on vehicles — views, video, garage, compare, cart, pre-order';

-- Dedupe local-availability email per vehicle + email + availability event
CREATE TABLE IF NOT EXISTS vehicle_availability_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id TEXT NOT NULL,
  email TEXT NOT NULL,
  local_availability_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (vehicle_id, email, local_availability_at)
);

CREATE INDEX IF NOT EXISTS idx_vehicle_avail_notify_vehicle
  ON vehicle_availability_notifications(vehicle_id);

ALTER TABLE vehicle_interest ENABLE ROW LEVEL SECURITY;
ALTER TABLE vehicle_availability_notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "No public access to vehicle_interest" ON vehicle_interest;
CREATE POLICY "No public access to vehicle_interest"
  ON vehicle_interest FOR ALL USING (false) WITH CHECK (false);

DROP POLICY IF EXISTS "No public access to vehicle_availability_notifications" ON vehicle_availability_notifications;
CREATE POLICY "No public access to vehicle_availability_notifications"
  ON vehicle_availability_notifications FOR ALL USING (false) WITH CHECK (false);
