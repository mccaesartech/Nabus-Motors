-- Pre-order vehicles and inquiry submissions
-- Uses existing vehicles.status column (available, pre_order, reserved, sold)

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Ensure vehicles.status supports pre_order (column already exists from initial schema)
ALTER TABLE vehicles
  DROP CONSTRAINT IF EXISTS vehicles_status_check;

ALTER TABLE vehicles
  ADD CONSTRAINT vehicles_status_check
  CHECK (status IN ('available', 'pre_order', 'reserved', 'sold'));

-- Public site may list available and pre-order vehicles
DROP POLICY IF EXISTS "Vehicles are publicly readable" ON vehicles;
CREATE POLICY "Vehicles are publicly readable"
  ON vehicles FOR SELECT
  USING (status IN ('available', 'pre_order'));

-- ─── Pre-order inquiries ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS preorder_inquiries (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  vehicle_id UUID REFERENCES vehicles(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  message TEXT,
  down_payment_usd INTEGER NOT NULL DEFAULT 0,
  status TEXT DEFAULT 'new',
  source TEXT DEFAULT 'website',
  follow_up_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_preorder_inquiries_vehicle ON preorder_inquiries(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_preorder_inquiries_status ON preorder_inquiries(status);
CREATE INDEX IF NOT EXISTS idx_preorder_inquiries_created ON preorder_inquiries(created_at DESC);

ALTER TABLE preorder_inquiries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can submit preorder inquiries" ON preorder_inquiries;
CREATE POLICY "Anyone can submit preorder inquiries"
  ON preorder_inquiries FOR INSERT WITH CHECK (true);
