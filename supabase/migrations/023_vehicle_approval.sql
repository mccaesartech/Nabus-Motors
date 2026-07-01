-- Manager inventory submissions require owner / super-admin approval before going live.

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

ALTER TABLE vehicles
  ADD COLUMN IF NOT EXISTS approval_status TEXT NOT NULL DEFAULT 'approved',
  ADD COLUMN IF NOT EXISTS approval_note TEXT,
  ADD COLUMN IF NOT EXISTS submitted_by UUID REFERENCES platform_users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS reviewed_by TEXT,
  ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ;

ALTER TABLE vehicles
  DROP CONSTRAINT IF EXISTS vehicles_approval_status_check;

ALTER TABLE vehicles
  ADD CONSTRAINT vehicles_approval_status_check
  CHECK (approval_status IN ('approved', 'pending_approval', 'rejected'));

-- Existing inventory is already live.
UPDATE vehicles SET approval_status = 'approved' WHERE approval_status IS NULL;

CREATE INDEX IF NOT EXISTS idx_vehicles_approval_status
  ON vehicles (approval_status, created_at DESC);

-- Public site only lists approved vehicles.
DROP POLICY IF EXISTS "Vehicles are publicly readable" ON vehicles;
CREATE POLICY "Vehicles are publicly readable"
  ON vehicles FOR SELECT
  USING (
    status IN ('available', 'pre_order')
    AND approval_status = 'approved'
  );
