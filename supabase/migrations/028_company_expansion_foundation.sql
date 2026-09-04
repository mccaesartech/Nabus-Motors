-- Nabus Motors and Trading — foundational schema
-- Safe to run multiple times (idempotent where possible)

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ─── Company CMS snippets ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS company_content (
  key TEXT PRIMARY KEY,
  content JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO company_content (key, content) VALUES
  (
    'clearing_fee_notice',
    '{"title":"Clearing & customs notice","body":"Clearing fees, duties, and port charges vary by shipment type, vehicle value, and Ghana Customs assessment. Nabus Motors will provide a detailed breakdown before you commit. Contact our freight team for a personalised quote — prices are not fixed on this notice."}'::jsonb
  )
ON CONFLICT (key) DO NOTHING;

ALTER TABLE company_content ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "company_content_deny_all" ON company_content;
CREATE POLICY "company_content_deny_all" ON company_content
  FOR ALL USING (false) WITH CHECK (false);

-- Admin-editable clearing notice via existing site_settings (pre-order form)
INSERT INTO site_settings (key, value) VALUES
  (
    'clearing_fee_notice',
    'Clearing fees, duties, and port charges vary by shipment type, vehicle value, and Ghana Customs assessment. Nabus Motors will provide a detailed breakdown before you commit. Contact our freight team for a personalised quote — prices are not fixed on this notice.'
  )
ON CONFLICT (key) DO NOTHING;

-- ─── Vehicle inventory extensions ─────────────────────────────────────────────
ALTER TABLE vehicles
  ADD COLUMN IF NOT EXISTS inventory_type TEXT DEFAULT 'available',
  ADD COLUMN IF NOT EXISTS source_country TEXT,
  ADD COLUMN IF NOT EXISTS location_ghana TEXT;

ALTER TABLE vehicles
  DROP CONSTRAINT IF EXISTS vehicles_inventory_type_check;

ALTER TABLE vehicles
  ADD CONSTRAINT vehicles_inventory_type_check
  CHECK (inventory_type IN ('available', 'preorder'));

CREATE INDEX IF NOT EXISTS idx_vehicles_inventory_type ON vehicles(inventory_type);
CREATE INDEX IF NOT EXISTS idx_vehicles_source_country ON vehicles(source_country);

-- Backfill inventory_type from status where applicable
UPDATE vehicles
SET inventory_type = 'preorder'
WHERE status = 'pre_order' AND (inventory_type IS NULL OR inventory_type = 'available');

-- ─── Pre-order shipping handling ──────────────────────────────────────────────
ALTER TABLE preorder_inquiries
  ADD COLUMN IF NOT EXISTS shipping_handling TEXT,
  ADD COLUMN IF NOT EXISTS shipping_terms_accepted BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS shipping_terms_accepted_at TIMESTAMPTZ;

ALTER TABLE preorder_inquiries
  DROP CONSTRAINT IF EXISTS preorder_inquiries_shipping_handling_check;

ALTER TABLE preorder_inquiries
  ADD CONSTRAINT preorder_inquiries_shipping_handling_check
  CHECK (
    shipping_handling IS NULL
    OR shipping_handling IN ('customer_arranged', 'true_goshen', 'consultation')
  );

-- ─── Freight quote requests ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS freight_quote_requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  service_type TEXT NOT NULL DEFAULT 'vehicle_shipping',
  origin_country TEXT,
  destination TEXT DEFAULT 'Ghana',
  cargo_description TEXT,
  estimated_value_usd INTEGER,
  message TEXT,
  status TEXT NOT NULL DEFAULT 'new',
  source TEXT DEFAULT 'website',
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE freight_quote_requests
  DROP CONSTRAINT IF EXISTS freight_quote_requests_service_type_check;

ALTER TABLE freight_quote_requests
  ADD CONSTRAINT freight_quote_requests_service_type_check
  CHECK (service_type IN (
    'vehicle_shipping',
    'container_shipping',
    'documentation',
    'clearing',
    'other'
  ));

ALTER TABLE freight_quote_requests
  DROP CONSTRAINT IF EXISTS freight_quote_requests_status_check;

ALTER TABLE freight_quote_requests
  ADD CONSTRAINT freight_quote_requests_status_check
  CHECK (status IN ('new', 'contacted', 'quoted', 'accepted', 'closed', 'cancelled'));

CREATE INDEX IF NOT EXISTS idx_freight_quotes_status ON freight_quote_requests(status);
CREATE INDEX IF NOT EXISTS idx_freight_quotes_created ON freight_quote_requests(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_freight_quotes_email ON freight_quote_requests(email);

ALTER TABLE freight_quote_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can submit freight quote requests" ON freight_quote_requests;
CREATE POLICY "Anyone can submit freight quote requests"
  ON freight_quote_requests FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Users can view own freight quote requests" ON freight_quote_requests;
CREATE POLICY "Users can view own freight quote requests"
  ON freight_quote_requests FOR SELECT
  USING (auth.uid() IS NOT NULL AND user_id = auth.uid());

DROP POLICY IF EXISTS "Service role manages freight quote requests" ON freight_quote_requests;
CREATE POLICY "Service role manages freight quote requests"
  ON freight_quote_requests FOR ALL USING (false) WITH CHECK (false);

-- ─── Auto parts ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS parts_categories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  description TEXT,
  icon TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS parts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  category_id UUID REFERENCES parts_categories(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  sku TEXT,
  description TEXT,
  price_usd INTEGER,
  currency TEXT DEFAULT 'USD',
  brand TEXT,
  compatible_makes TEXT[] DEFAULT '{}',
  compatible_models TEXT[] DEFAULT '{}',
  images TEXT[] DEFAULT '{}',
  stock_quantity INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'draft',
  is_featured BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE parts
  DROP CONSTRAINT IF EXISTS parts_status_check;

ALTER TABLE parts
  ADD CONSTRAINT parts_status_check
  CHECK (status IN ('draft', 'published', 'archived'));

CREATE INDEX IF NOT EXISTS idx_parts_category ON parts(category_id);
CREATE INDEX IF NOT EXISTS idx_parts_status ON parts(status);
CREATE INDEX IF NOT EXISTS idx_parts_slug ON parts(slug);
CREATE INDEX IF NOT EXISTS idx_parts_categories_slug ON parts_categories(slug);
CREATE INDEX IF NOT EXISTS idx_parts_categories_active ON parts_categories(is_active);

ALTER TABLE parts_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE parts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Published parts are publicly readable" ON parts;
CREATE POLICY "Published parts are publicly readable"
  ON parts FOR SELECT
  USING (status = 'published');

DROP POLICY IF EXISTS "Active parts categories are publicly readable" ON parts_categories;
CREATE POLICY "Active parts categories are publicly readable"
  ON parts_categories FOR SELECT
  USING (is_active = true);

DROP POLICY IF EXISTS "Service role manages parts" ON parts;
CREATE POLICY "Service role manages parts"
  ON parts FOR ALL USING (false) WITH CHECK (false);

DROP POLICY IF EXISTS "Service role manages parts categories" ON parts_categories;
CREATE POLICY "Service role manages parts_categories"
  ON parts_categories FOR ALL USING (false) WITH CHECK (false);

INSERT INTO parts_categories (name, slug, description, sort_order) VALUES
  ('Engine & Drivetrain', 'engine-drivetrain', 'Engines, transmissions, and drivetrain components', 1),
  ('Brakes & Suspension', 'brakes-suspension', 'Brake pads, rotors, shocks, and suspension parts', 2),
  ('Electrical & Lighting', 'electrical-lighting', 'Batteries, alternators, bulbs, and wiring', 3),
  ('Body & Exterior', 'body-exterior', 'Panels, mirrors, bumpers, and trim', 4),
  ('Interior & Comfort', 'interior-comfort', 'Seats, dashboards, AC parts, and accessories', 5),
  ('Filters & Fluids', 'filters-fluids', 'Oil filters, air filters, coolants, and lubricants', 6)
ON CONFLICT (slug) DO NOTHING;

-- ─── Vehicle appointments ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS vehicle_appointments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  vehicle_id UUID REFERENCES vehicles(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  appointment_type TEXT NOT NULL DEFAULT 'viewing',
  preferred_date DATE,
  preferred_time TEXT,
  branch TEXT DEFAULT 'Accra',
  status TEXT NOT NULL DEFAULT 'pending',
  confirmation_method TEXT DEFAULT 'email',
  notes TEXT,
  confirmed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE vehicle_appointments
  DROP CONSTRAINT IF EXISTS vehicle_appointments_type_check;

ALTER TABLE vehicle_appointments
  ADD CONSTRAINT vehicle_appointments_type_check
  CHECK (appointment_type IN ('viewing', 'inspection', 'test_drive'));

ALTER TABLE vehicle_appointments
  DROP CONSTRAINT IF EXISTS vehicle_appointments_status_check;

ALTER TABLE vehicle_appointments
  ADD CONSTRAINT vehicle_appointments_status_check
  CHECK (status IN ('pending', 'confirmed', 'completed', 'cancelled', 'no_show'));

ALTER TABLE vehicle_appointments
  DROP CONSTRAINT IF EXISTS vehicle_appointments_confirmation_check;

ALTER TABLE vehicle_appointments
  ADD CONSTRAINT vehicle_appointments_confirmation_check
  CHECK (confirmation_method IN ('email', 'sms', 'whatsapp', 'phone'));

CREATE INDEX IF NOT EXISTS idx_vehicle_appointments_status ON vehicle_appointments(status);
CREATE INDEX IF NOT EXISTS idx_vehicle_appointments_date ON vehicle_appointments(preferred_date);
CREATE INDEX IF NOT EXISTS idx_vehicle_appointments_user ON vehicle_appointments(user_id);

ALTER TABLE vehicle_appointments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can request vehicle appointments" ON vehicle_appointments;
CREATE POLICY "Anyone can request vehicle appointments"
  ON vehicle_appointments FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Users can view own vehicle appointments" ON vehicle_appointments;
CREATE POLICY "Users can view own vehicle appointments"
  ON vehicle_appointments FOR SELECT
  USING (auth.uid() IS NOT NULL AND user_id = auth.uid());

DROP POLICY IF EXISTS "Service role manages vehicle appointments" ON vehicle_appointments;
CREATE POLICY "Service role manages vehicle appointments"
  ON vehicle_appointments FOR ALL USING (false) WITH CHECK (false);

-- ─── Shipment tracking ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS shipment_tracking (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tracking_number TEXT UNIQUE NOT NULL,
  reference_type TEXT NOT NULL DEFAULT 'preorder',
  reference_id UUID,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  customer_name TEXT,
  customer_email TEXT,
  origin_country TEXT,
  destination TEXT DEFAULT 'Ghana',
  vessel_name TEXT,
  container_number TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  estimated_arrival DATE,
  actual_arrival DATE,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS shipment_timeline_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  shipment_id UUID NOT NULL REFERENCES shipment_tracking(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  location TEXT,
  event_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  is_customer_visible BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE shipment_tracking
  DROP CONSTRAINT IF EXISTS shipment_tracking_reference_type_check;

ALTER TABLE shipment_tracking
  ADD CONSTRAINT shipment_tracking_reference_type_check
  CHECK (reference_type IN ('preorder', 'freight', 'parts', 'other'));

ALTER TABLE shipment_tracking
  DROP CONSTRAINT IF EXISTS shipment_tracking_status_check;

ALTER TABLE shipment_tracking
  ADD CONSTRAINT shipment_tracking_status_check
  CHECK (status IN (
    'pending',
    'booked',
    'in_transit',
    'at_port',
    'clearing',
    'delivered',
    'cancelled'
  ));

CREATE INDEX IF NOT EXISTS idx_shipment_tracking_number ON shipment_tracking(tracking_number);
CREATE INDEX IF NOT EXISTS idx_shipment_tracking_user ON shipment_tracking(user_id);
CREATE INDEX IF NOT EXISTS idx_shipment_tracking_status ON shipment_tracking(status);
CREATE INDEX IF NOT EXISTS idx_shipment_timeline_shipment ON shipment_timeline_events(shipment_id);
CREATE INDEX IF NOT EXISTS idx_shipment_timeline_event_at ON shipment_timeline_events(event_at DESC);

ALTER TABLE shipment_tracking ENABLE ROW LEVEL SECURITY;
ALTER TABLE shipment_timeline_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own shipments" ON shipment_tracking;
CREATE POLICY "Users can view own shipments"
  ON shipment_tracking FOR SELECT
  USING (auth.uid() IS NOT NULL AND user_id = auth.uid());

DROP POLICY IF EXISTS "Service role manages shipment tracking" ON shipment_tracking;
CREATE POLICY "Service role manages shipment tracking"
  ON shipment_tracking FOR ALL USING (false) WITH CHECK (false);

DROP POLICY IF EXISTS "Users can view own shipment timeline events" ON shipment_timeline_events;
CREATE POLICY "Users can view own shipment timeline events"
  ON shipment_timeline_events FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM shipment_tracking s
      WHERE s.id = shipment_timeline_events.shipment_id
        AND s.user_id = auth.uid()
        AND shipment_timeline_events.is_customer_visible = true
    )
  );

DROP POLICY IF EXISTS "Service role manages shipment timeline events" ON shipment_timeline_events;
CREATE POLICY "Service role manages shipment timeline events"
  ON shipment_timeline_events FOR ALL USING (false) WITH CHECK (false);

-- ─── Updated_at triggers (reuse set_updated_at if present) ────────────────────
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'set_updated_at') THEN
    CREATE OR REPLACE FUNCTION set_updated_at()
    RETURNS TRIGGER AS $fn$
    BEGIN
      NEW.updated_at = NOW();
      RETURN NEW;
    END;
    $fn$ LANGUAGE plpgsql;
  END IF;
END $$;

DROP TRIGGER IF EXISTS freight_quote_requests_updated_at ON freight_quote_requests;
CREATE TRIGGER freight_quote_requests_updated_at
  BEFORE UPDATE ON freight_quote_requests
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS parts_categories_updated_at ON parts_categories;
CREATE TRIGGER parts_categories_updated_at
  BEFORE UPDATE ON parts_categories
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS parts_updated_at ON parts;
CREATE TRIGGER parts_updated_at
  BEFORE UPDATE ON parts
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS vehicle_appointments_updated_at ON vehicle_appointments;
CREATE TRIGGER vehicle_appointments_updated_at
  BEFORE UPDATE ON vehicle_appointments
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS shipment_tracking_updated_at ON shipment_tracking;
CREATE TRIGGER shipment_tracking_updated_at
  BEFORE UPDATE ON shipment_tracking
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
