-- Nabus Motors — full database setup
-- Generated: 2026-09-04T11:45:18.703Z
-- Paste this ENTIRE file into Supabase Dashboard → SQL Editor → Run once.
-- Project: nabus-motors (fresh Supabase project)
--
-- After this succeeds, run supabase/seed-vehicles.sql in a second query.


-- ─── 001_initial.sql ───
-- True Goshen Auto Database Schema

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users profile (extends Supabase auth.users)
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  first_name TEXT,
  last_name TEXT,
  phone TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Vehicles inventory
CREATE TABLE vehicles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  slug TEXT UNIQUE NOT NULL,
  make TEXT NOT NULL,
  model TEXT NOT NULL,
  year INTEGER NOT NULL,
  trim TEXT,
  price INTEGER NOT NULL,
  mileage INTEGER NOT NULL,
  fuel_type TEXT NOT NULL,
  transmission TEXT NOT NULL,
  condition TEXT NOT NULL,
  body_type TEXT NOT NULL,
  location TEXT NOT NULL,
  engine_size TEXT,
  color TEXT,
  vin TEXT UNIQUE,
  description TEXT,
  featured BOOLEAN DEFAULT FALSE,
  images TEXT[] DEFAULT '{}',
  specs JSONB DEFAULT '[]',
  history JSONB DEFAULT '[]',
  status TEXT DEFAULT 'available',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Saved vehicles (garage)
CREATE TABLE saved_vehicles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  vehicle_id UUID NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
  saved_price INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, vehicle_id)
);

-- Finance applications
CREATE TABLE finance_applications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT NOT NULL,
  annual_income_range TEXT,
  credit_score_range TEXT,
  vehicle_of_interest TEXT,
  notes TEXT,
  status TEXT DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Contact inquiries
CREATE TABLE contact_inquiries (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  subject TEXT,
  message TEXT NOT NULL,
  status TEXT DEFAULT 'new',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Sell/trade appraisals
CREATE TABLE appraisal_requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  make TEXT NOT NULL,
  model TEXT NOT NULL,
  year INTEGER NOT NULL,
  mileage INTEGER NOT NULL,
  condition TEXT,
  seller_name TEXT NOT NULL,
  seller_phone TEXT NOT NULL,
  notes TEXT,
  status TEXT DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Newsletter subscribers
CREATE TABLE newsletter_subscribers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email TEXT UNIQUE NOT NULL,
  subscribed_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_vehicles_make ON vehicles(make);
CREATE INDEX idx_vehicles_body_type ON vehicles(body_type);
CREATE INDEX idx_vehicles_price ON vehicles(price);
CREATE INDEX idx_vehicles_featured ON vehicles(featured);
CREATE INDEX idx_saved_vehicles_user ON saved_vehicles(user_id);

-- Row Level Security
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE saved_vehicles ENABLE ROW LEVEL SECURITY;
ALTER TABLE finance_applications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public profiles are viewable by owner"
  ON profiles FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users can view own saved vehicles"
  ON saved_vehicles FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can manage own saved vehicles"
  ON saved_vehicles FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Anyone can submit finance applications"
  ON finance_applications FOR INSERT WITH CHECK (true);

CREATE POLICY "Users can view own finance applications"
  ON finance_applications FOR SELECT USING (auth.uid() = user_id);

-- Vehicles are publicly readable
ALTER TABLE vehicles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Vehicles are publicly readable"
  ON vehicles FOR SELECT USING (status = 'available');


-- ─── 002_inquiries.sql ───
-- Vehicle purchase / rental / test drive inquiries
CREATE TABLE IF NOT EXISTS vehicle_inquiries (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  inquiry_type TEXT NOT NULL,
  vehicle_slug TEXT,
  vehicle_name TEXT,
  message TEXT,
  status TEXT DEFAULT 'new',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE contact_inquiries ENABLE ROW LEVEL SECURITY;
ALTER TABLE appraisal_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE newsletter_subscribers ENABLE ROW LEVEL SECURITY;
ALTER TABLE vehicle_inquiries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can submit contact inquiries"
  ON contact_inquiries FOR INSERT WITH CHECK (true);

CREATE POLICY "Anyone can submit appraisal requests"
  ON appraisal_requests FOR INSERT WITH CHECK (true);

CREATE POLICY "Anyone can subscribe to newsletter"
  ON newsletter_subscribers FOR INSERT WITH CHECK (true);

CREATE POLICY "Anyone can submit vehicle inquiries"
  ON vehicle_inquiries FOR INSERT WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_vehicle_inquiries_status ON vehicle_inquiries(status);
CREATE INDEX IF NOT EXISTS idx_contact_inquiries_status ON contact_inquiries(status);


-- ─── 003_platform_extensions.sql ───
-- True Goshen Platform — customers, sales, lead extensions
-- Safe to run multiple times; does not alter existing vehicle/inquiry schemas destructively

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ─── Customers ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS customers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  first_name TEXT,
  last_name TEXT,
  email TEXT UNIQUE NOT NULL,
  phone TEXT,
  source TEXT DEFAULT 'website',
  status TEXT DEFAULT 'active',
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─── Sales ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS sales (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
  vehicle_id UUID REFERENCES vehicles(id) ON DELETE SET NULL,
  sale_price INTEGER NOT NULL DEFAULT 0,
  status TEXT DEFAULT 'pending',
  sale_date TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─── Lead extensions (source + follow-up notes) ───────────────────────────────
ALTER TABLE contact_inquiries
  ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'website',
  ADD COLUMN IF NOT EXISTS follow_up_notes TEXT;

ALTER TABLE vehicle_inquiries
  ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'website',
  ADD COLUMN IF NOT EXISTS follow_up_notes TEXT;

ALTER TABLE finance_applications
  ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'website',
  ADD COLUMN IF NOT EXISTS follow_up_notes TEXT;

ALTER TABLE appraisal_requests
  ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'website',
  ADD COLUMN IF NOT EXISTS follow_up_notes TEXT;

-- ─── Indexes ────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_customers_email ON customers(email);
CREATE INDEX IF NOT EXISTS idx_customers_status ON customers(status);
CREATE INDEX IF NOT EXISTS idx_sales_status ON sales(status);
CREATE INDEX IF NOT EXISTS idx_sales_customer ON sales(customer_id);
CREATE INDEX IF NOT EXISTS idx_sales_vehicle ON sales(vehicle_id);

-- ─── RLS (service role bypasses; anon has no access) ────────────────────────
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role manages customers" ON customers;
CREATE POLICY "Service role manages customers"
  ON customers FOR ALL USING (false) WITH CHECK (false);

DROP POLICY IF EXISTS "Service role manages sales" ON sales;
CREATE POLICY "Service role manages sales"
  ON sales FOR ALL USING (false) WITH CHECK (false);

-- ─── Updated_at triggers ────────────────────────────────────────────────────
DROP TRIGGER IF EXISTS customers_updated_at ON customers;
CREATE TRIGGER customers_updated_at
  BEFORE UPDATE ON customers
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS sales_updated_at ON sales;
CREATE TRIGGER sales_updated_at
  BEFORE UPDATE ON sales
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();


-- ─── 004_preorder.sql ───
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


-- ─── 005_admin_notifications.sql ───
-- Admin notification center: persisted notifications + triggers on new inquiries

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS admin_notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  link TEXT,
  source_table TEXT,
  source_id UUID,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_admin_notifications_unread
  ON admin_notifications (created_at DESC)
  WHERE read_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_admin_notifications_created
  ON admin_notifications (created_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS idx_admin_notifications_source
  ON admin_notifications (source_table, source_id)
  WHERE source_id IS NOT NULL;

ALTER TABLE admin_notifications ENABLE ROW LEVEL SECURITY;

-- Service role bypasses RLS; block anon access
DROP POLICY IF EXISTS "No public access to admin notifications" ON admin_notifications;
CREATE POLICY "No public access to admin notifications"
  ON admin_notifications FOR ALL USING (false) WITH CHECK (false);

-- ─── Trigger helper ───────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION notify_admin_inquiry()
RETURNS TRIGGER AS $$
DECLARE
  v_type TEXT;
  v_title TEXT;
  v_message TEXT;
  v_link TEXT;
  v_name TEXT;
BEGIN
  v_type := TG_ARGV[0];
  v_link := TG_ARGV[1];

  IF TG_TABLE_NAME = 'preorder_inquiries' THEN
    v_name := NEW.name;
    v_title := 'New pre-order inquiry';
    v_message := v_name || ' submitted a pre-order request';
  ELSIF TG_TABLE_NAME = 'vehicle_inquiries' THEN
    v_name := NEW.name;
    v_title := 'New vehicle inquiry';
    v_message := v_name || ' inquired about ' || COALESCE(NEW.vehicle_name, NEW.vehicle_slug, 'a vehicle');
  ELSIF TG_TABLE_NAME = 'contact_inquiries' THEN
    v_name := NEW.name;
    v_title := 'New contact message';
    v_message := v_name || ': ' || LEFT(COALESCE(NEW.subject, NEW.message, ''), 80);
  ELSIF TG_TABLE_NAME = 'finance_applications' THEN
    v_name := NEW.first_name || ' ' || NEW.last_name;
    v_title := 'New finance application';
    v_message := TRIM(v_name) || ' applied for financing';
  ELSIF TG_TABLE_NAME = 'appraisal_requests' THEN
    v_name := NEW.seller_name;
    v_title := 'New appraisal request';
    v_message := v_name || ' wants to sell a ' || NEW.year || ' ' || NEW.make || ' ' || NEW.model;
  ELSE
    RETURN NEW;
  END IF;

  INSERT INTO admin_notifications (type, title, message, link, source_table, source_id)
  VALUES (v_type, v_title, v_message, v_link, TG_TABLE_NAME, NEW.id)
  ON CONFLICT (source_table, source_id) WHERE source_id IS NOT NULL DO NOTHING;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ─── Inquiry triggers ─────────────────────────────────────────────────────────
DROP TRIGGER IF EXISTS trg_notify_preorder ON preorder_inquiries;
CREATE TRIGGER trg_notify_preorder
  AFTER INSERT ON preorder_inquiries
  FOR EACH ROW EXECUTE FUNCTION notify_admin_inquiry('preorder', '/platform/leads?tab=preorder');

DROP TRIGGER IF EXISTS trg_notify_vehicle_inquiry ON vehicle_inquiries;
CREATE TRIGGER trg_notify_vehicle_inquiry
  AFTER INSERT ON vehicle_inquiries
  FOR EACH ROW EXECUTE FUNCTION notify_admin_inquiry('vehicle', '/platform/leads?tab=vehicle');

DROP TRIGGER IF EXISTS trg_notify_contact ON contact_inquiries;
CREATE TRIGGER trg_notify_contact
  AFTER INSERT ON contact_inquiries
  FOR EACH ROW EXECUTE FUNCTION notify_admin_inquiry('contact', '/platform/leads?tab=contact');

DROP TRIGGER IF EXISTS trg_notify_finance ON finance_applications;
CREATE TRIGGER trg_notify_finance
  AFTER INSERT ON finance_applications
  FOR EACH ROW EXECUTE FUNCTION notify_admin_inquiry('finance', '/platform/leads?tab=finance');

DROP TRIGGER IF EXISTS trg_notify_appraisal ON appraisal_requests;
CREATE TRIGGER trg_notify_appraisal
  AFTER INSERT ON appraisal_requests
  FOR EACH ROW EXECUTE FUNCTION notify_admin_inquiry('appraisal', '/platform/leads?tab=appraisal');

-- ─── Backfill open inquiries as notifications ─────────────────────────────────
INSERT INTO admin_notifications (type, title, message, link, source_table, source_id, created_at)
SELECT
  'preorder',
  'New pre-order inquiry',
  p.name || ' submitted a pre-order request',
  '/platform/leads?tab=preorder',
  'preorder_inquiries',
  p.id,
  p.created_at
FROM preorder_inquiries p
WHERE p.status IN ('new', 'pending')
ON CONFLICT (source_table, source_id) WHERE source_id IS NOT NULL DO NOTHING;

INSERT INTO admin_notifications (type, title, message, link, source_table, source_id, created_at)
SELECT
  'vehicle',
  'New vehicle inquiry',
  v.name || ' inquired about ' || COALESCE(v.vehicle_name, v.vehicle_slug, 'a vehicle'),
  '/platform/leads?tab=vehicle',
  'vehicle_inquiries',
  v.id,
  v.created_at
FROM vehicle_inquiries v
WHERE v.status IN ('new', 'pending')
ON CONFLICT (source_table, source_id) WHERE source_id IS NOT NULL DO NOTHING;

INSERT INTO admin_notifications (type, title, message, link, source_table, source_id, created_at)
SELECT
  'contact',
  'New contact message',
  c.name || ': ' || LEFT(COALESCE(c.subject, c.message, ''), 80),
  '/platform/leads?tab=contact',
  'contact_inquiries',
  c.id,
  c.created_at
FROM contact_inquiries c
WHERE c.status IN ('new', 'pending')
ON CONFLICT (source_table, source_id) WHERE source_id IS NOT NULL DO NOTHING;

INSERT INTO admin_notifications (type, title, message, link, source_table, source_id, created_at)
SELECT
  'finance',
  'New finance application',
  TRIM(f.first_name || ' ' || f.last_name) || ' applied for financing',
  '/platform/leads?tab=finance',
  'finance_applications',
  f.id,
  f.created_at
FROM finance_applications f
WHERE f.status IN ('new', 'pending')
ON CONFLICT (source_table, source_id) WHERE source_id IS NOT NULL DO NOTHING;

INSERT INTO admin_notifications (type, title, message, link, source_table, source_id, created_at)
SELECT
  'appraisal',
  'New appraisal request',
  a.seller_name || ' wants to sell a ' || a.year || ' ' || a.make || ' ' || a.model,
  '/platform/leads?tab=appraisal',
  'appraisal_requests',
  a.id,
  a.created_at
FROM appraisal_requests a
WHERE a.status IN ('new', 'pending')
ON CONFLICT (source_table, source_id) WHERE source_id IS NOT NULL DO NOTHING;


-- ─── 006_preorder_notification_details.sql ───
-- Rich pre-order notifications with vehicle + customer metadata

-- Denormalized vehicle snapshot (survives vehicle deletion / missing FK)
ALTER TABLE preorder_inquiries
  ADD COLUMN IF NOT EXISTS vehicle_slug TEXT,
  ADD COLUMN IF NOT EXISTS vehicle_title TEXT,
  ADD COLUMN IF NOT EXISTS vehicle_price_usd INTEGER;

-- Structured notification payload for admin UI
ALTER TABLE admin_notifications
  ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;

CREATE OR REPLACE FUNCTION notify_admin_inquiry()
RETURNS TRIGGER AS $$
DECLARE
  v_type TEXT;
  v_title TEXT;
  v_message TEXT;
  v_link TEXT;
  v_name TEXT;
  v_metadata JSONB := '{}'::jsonb;
  v_vehicle RECORD;
  v_vehicle_title TEXT;
  v_image TEXT;
BEGIN
  v_type := TG_ARGV[0];
  v_link := TG_ARGV[1];

  IF TG_TABLE_NAME = 'preorder_inquiries' THEN
    v_name := NEW.name;
    v_vehicle := NULL;

    IF NEW.vehicle_id IS NOT NULL THEN
      SELECT id, year, make, model, slug, price, images, trim, status
      INTO v_vehicle
      FROM vehicles
      WHERE id = NEW.vehicle_id;
    END IF;

    v_vehicle_title := COALESCE(
      NEW.vehicle_title,
      CASE
        WHEN v_vehicle.id IS NOT NULL THEN
          v_vehicle.year || ' ' || v_vehicle.make || ' ' || v_vehicle.model
        ELSE NULL
      END,
      'Unknown vehicle'
    );

    v_image := NULL;
    IF v_vehicle.images IS NOT NULL AND array_length(v_vehicle.images, 1) > 0 THEN
      v_image := v_vehicle.images[1];
    END IF;

    v_title := 'Pre-order: ' || v_vehicle_title;
    v_message := v_name || ' · ' || v_vehicle_title || ' · $'
      || to_char(COALESCE(NEW.down_payment_usd, 0), 'FM999,999') || ' down';
    v_link := '/platform/leads/preorder/' || NEW.id::text;

    v_metadata := jsonb_build_object(
      'customer', jsonb_build_object(
        'name', NEW.name,
        'email', NEW.email,
        'phone', NEW.phone,
        'message', NEW.message
      ),
      'vehicle', jsonb_build_object(
        'id', COALESCE(NEW.vehicle_id::text, v_vehicle.id::text),
        'year', COALESCE(v_vehicle.year, NULL),
        'make', v_vehicle.make,
        'model', v_vehicle.model,
        'slug', COALESCE(NEW.vehicle_slug, v_vehicle.slug),
        'price', COALESCE(NEW.vehicle_price_usd, v_vehicle.price),
        'image', v_image,
        'title', v_vehicle_title,
        'status', v_vehicle.status
      ),
      'downPaymentUsd', NEW.down_payment_usd,
      'downPaymentFormatted', '$' || to_char(COALESCE(NEW.down_payment_usd, 0), 'FM999,999')
    );

  ELSIF TG_TABLE_NAME = 'vehicle_inquiries' THEN
    v_name := NEW.name;
    v_title := 'New vehicle inquiry';
    v_message := v_name || ' inquired about ' || COALESCE(NEW.vehicle_name, NEW.vehicle_slug, 'a vehicle');
  ELSIF TG_TABLE_NAME = 'contact_inquiries' THEN
    v_name := NEW.name;
    v_title := 'New contact message';
    v_message := v_name || ': ' || LEFT(COALESCE(NEW.subject, NEW.message, ''), 80);
  ELSIF TG_TABLE_NAME = 'finance_applications' THEN
    v_name := NEW.first_name || ' ' || NEW.last_name;
    v_title := 'New finance application';
    v_message := TRIM(v_name) || ' applied for financing';
  ELSIF TG_TABLE_NAME = 'appraisal_requests' THEN
    v_name := NEW.seller_name;
    v_title := 'New appraisal request';
    v_message := v_name || ' wants to sell a ' || NEW.year || ' ' || NEW.make || ' ' || NEW.model;
  ELSE
    RETURN NEW;
  END IF;

  INSERT INTO admin_notifications (type, title, message, link, source_table, source_id, metadata)
  VALUES (v_type, v_title, v_message, v_link, TG_TABLE_NAME, NEW.id, v_metadata)
  ON CONFLICT (source_table, source_id) WHERE source_id IS NOT NULL DO NOTHING;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Re-create preorder trigger (link overridden in function for pre-orders)
DROP TRIGGER IF EXISTS trg_notify_preorder ON preorder_inquiries;
CREATE TRIGGER trg_notify_preorder
  AFTER INSERT ON preorder_inquiries
  FOR EACH ROW EXECUTE FUNCTION notify_admin_inquiry('preorder', '/platform/leads?tab=preorder');

-- Backfill denormalized vehicle fields on existing pre-orders
UPDATE preorder_inquiries p
SET
  vehicle_slug = COALESCE(p.vehicle_slug, v.slug),
  vehicle_title = COALESCE(
    p.vehicle_title,
    v.year || ' ' || v.make || ' ' || v.model
  ),
  vehicle_price_usd = COALESCE(p.vehicle_price_usd, v.price)
FROM vehicles v
WHERE p.vehicle_id = v.id
  AND (p.vehicle_slug IS NULL OR p.vehicle_title IS NULL OR p.vehicle_price_usd IS NULL);

-- Refresh existing pre-order notifications with rich content
UPDATE admin_notifications n
SET
  title = 'Pre-order: ' || COALESCE(
    p.vehicle_title,
    v.year || ' ' || v.make || ' ' || v.model,
    'Unknown vehicle'
  ),
  message = p.name || ' · ' || COALESCE(
    p.vehicle_title,
    v.year || ' ' || v.make || ' ' || v.model,
    'Unknown vehicle'
  ) || ' · $' || to_char(COALESCE(p.down_payment_usd, 0), 'FM999,999') || ' down',
  link = '/platform/leads/preorder/' || p.id::text,
  metadata = jsonb_build_object(
    'customer', jsonb_build_object(
      'name', p.name,
      'email', p.email,
      'phone', p.phone,
      'message', p.message
    ),
    'vehicle', jsonb_build_object(
      'id', COALESCE(p.vehicle_id::text, v.id::text),
      'year', v.year,
      'make', v.make,
      'model', v.model,
      'slug', COALESCE(p.vehicle_slug, v.slug),
      'price', COALESCE(p.vehicle_price_usd, v.price),
      'image', CASE
        WHEN v.images IS NOT NULL AND array_length(v.images, 1) > 0 THEN v.images[1]
        ELSE NULL
      END,
      'title', COALESCE(
        p.vehicle_title,
        v.year || ' ' || v.make || ' ' || v.model,
        'Unknown vehicle'
      ),
      'status', v.status
    ),
    'downPaymentUsd', p.down_payment_usd,
    'downPaymentFormatted', '$' || to_char(COALESCE(p.down_payment_usd, 0), 'FM999,999')
  )
FROM preorder_inquiries p
LEFT JOIN vehicles v ON v.id = p.vehicle_id
WHERE n.source_table = 'preorder_inquiries'
  AND n.source_id = p.id;


-- ─── 007_preorder_payment_status.sql ───
-- Pre-order payment workflow (25% down payment tracking)

ALTER TABLE preorder_inquiries
  ADD COLUMN IF NOT EXISTS payment_status TEXT DEFAULT 'pending';

ALTER TABLE preorder_inquiries
  DROP CONSTRAINT IF EXISTS preorder_inquiries_payment_status_check;

ALTER TABLE preorder_inquiries
  ADD CONSTRAINT preorder_inquiries_payment_status_check
  CHECK (payment_status IN ('pending', 'down_payment_paid', 'completed', 'cancelled'));

CREATE INDEX IF NOT EXISTS idx_preorder_inquiries_payment_status
  ON preorder_inquiries(payment_status);

-- Ensure denormalized vehicle columns exist (from 006) for older databases
ALTER TABLE preorder_inquiries
  ADD COLUMN IF NOT EXISTS vehicle_slug TEXT,
  ADD COLUMN IF NOT EXISTS vehicle_title TEXT,
  ADD COLUMN IF NOT EXISTS vehicle_price_usd INTEGER;


-- ─── 008_platform_modules.sql ───
-- Platform modules: finance expenses, site settings, users, documents

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ─── Expenses ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS expenses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  description TEXT NOT NULL,
  amount_usd INTEGER NOT NULL DEFAULT 0,
  expense_date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_expenses_date ON expenses(expense_date DESC);

-- ─── Site settings (key-value store) ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS site_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL DEFAULT '',
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO site_settings (key, value) VALUES
  ('company_name', 'Nabus Motors'),
  ('phone', '+233 27 994 0200'),
  ('email', 'info@nabusmotors.com'),
  ('address', 'Accra Metropolitan District, Greater Accra, Ghana'),
  ('whatsapp_number', '233279940200'),
  ('notification_email', 'info@nabusmotors.com')
ON CONFLICT (key) DO NOTHING;

-- ─── Platform users (team roster; separate from Supabase auth) ────────────────
CREATE TABLE IF NOT EXISTS platform_users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  role TEXT NOT NULL DEFAULT 'Sales Officer',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_platform_users_email ON platform_users(email);

-- ─── Documents ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS documents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  doc_type TEXT NOT NULL DEFAULT 'other',
  url TEXT,
  vehicle_id UUID REFERENCES vehicles(id) ON DELETE SET NULL,
  customer_name TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_documents_type ON documents(doc_type);

-- ─── RLS (service role bypasses; anon has no access) ────────────────────────
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE site_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE platform_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role manages expenses" ON expenses;
CREATE POLICY "Service role manages expenses"
  ON expenses FOR ALL USING (false) WITH CHECK (false);

DROP POLICY IF EXISTS "Service role manages site_settings" ON site_settings;
CREATE POLICY "Service role manages site_settings"
  ON site_settings FOR ALL USING (false) WITH CHECK (false);

DROP POLICY IF EXISTS "Service role manages platform_users" ON platform_users;
CREATE POLICY "Service role manages platform_users"
  ON platform_users FOR ALL USING (false) WITH CHECK (false);

DROP POLICY IF EXISTS "Service role manages documents" ON documents;
CREATE POLICY "Service role manages documents"
  ON documents FOR ALL USING (false) WITH CHECK (false);


-- ─── 009_sales_extensions.sql ───
-- Sales module: quotations, pre-order linkage, customer contact fields

ALTER TABLE sales
  ADD COLUMN IF NOT EXISTS valid_until DATE,
  ADD COLUMN IF NOT EXISTS preorder_inquiry_id UUID REFERENCES preorder_inquiries(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS customer_name TEXT,
  ADD COLUMN IF NOT EXISTS customer_email TEXT;

ALTER TABLE sales ALTER COLUMN status SET DEFAULT 'draft';

UPDATE sales SET status = 'draft' WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_sales_preorder ON sales(preorder_inquiry_id);
CREATE INDEX IF NOT EXISTS idx_sales_valid_until ON sales(valid_until);


-- ─── 010_customer_auth.sql ───
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


-- ─── 011_vehicle_images_storage.sql ───
-- Vehicle image storage bucket (public read for website listings)
-- Create the bucket in Supabase Dashboard → Storage if this migration cannot run storage DDL.

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'vehicle-images',
  'vehicle-images',
  true,
  5242880,
  ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Public read access for listing photos
DROP POLICY IF EXISTS "Public read vehicle images" ON storage.objects;
CREATE POLICY "Public read vehicle images"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'vehicle-images');

-- Service role uploads bypass RLS; this policy documents intended admin upload path.
DROP POLICY IF EXISTS "Service role upload vehicle images" ON storage.objects;
CREATE POLICY "Service role upload vehicle images"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'vehicle-images');


-- ─── 012_vehicle_image_categories.sql ───
-- Categorized vehicle photo galleries (exterior, interior, engine, other)
ALTER TABLE vehicles
  ADD COLUMN IF NOT EXISTS gallery JSONB
  DEFAULT '{"exterior":[],"interior":[],"engine":[],"other":[]}'::jsonb;

-- Migrate legacy images[] into gallery.exterior
UPDATE vehicles
SET gallery = jsonb_build_object(
  'exterior', COALESCE(
    (SELECT jsonb_agg(to_jsonb(url)) FROM unnest(images) AS url),
    '[]'::jsonb
  ),
  'interior', '[]'::jsonb,
  'engine', '[]'::jsonb,
  'other', '[]'::jsonb
)
WHERE images IS NOT NULL
  AND array_length(images, 1) > 0
  AND (
    gallery IS NULL
    OR gallery = '{"exterior":[],"interior":[],"engine":[],"other":[]}'::jsonb
  );


-- ─── 013_customer_registration_id.sql ───
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


-- ─── 014_platform_user_invites.sql ───
-- Platform user invitations, roles, passwords (hashed), and activity log

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Extend platform_users for auth and profiles
ALTER TABLE platform_users
  ADD COLUMN IF NOT EXISTS password_hash TEXT,
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS phone TEXT,
  ADD COLUMN IF NOT EXISTS job_title TEXT,
  ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS invited_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS activated_at TIMESTAMPTZ;

ALTER TABLE platform_users DROP CONSTRAINT IF EXISTS platform_users_status_check;
ALTER TABLE platform_users
  ADD CONSTRAINT platform_users_status_check
  CHECK (status IN ('pending', 'active', 'disabled'));

ALTER TABLE platform_users DROP CONSTRAINT IF EXISTS platform_users_role_check;
ALTER TABLE platform_users
  ADD CONSTRAINT platform_users_role_check
  CHECK (role IN ('owner', 'super_admin', 'manager', 'staff'));

-- Map legacy display roles to canonical slugs
UPDATE platform_users SET role = 'super_admin' WHERE role IN ('Super Admin', 'super_admin');
UPDATE platform_users SET role = 'manager' WHERE role IN ('Manager', 'manager');
UPDATE platform_users SET role = 'staff' WHERE role IN ('Sales Officer', 'Finance Officer', 'Viewer', 'staff');
UPDATE platform_users SET role = 'owner' WHERE role IN ('owner', 'Owner');

UPDATE platform_users SET role = 'staff' WHERE role NOT IN ('owner', 'super_admin', 'manager', 'staff');

ALTER TABLE platform_users ALTER COLUMN role SET DEFAULT 'staff';

-- Invitations (token stored hashed; plain token only in invite link)
CREATE TABLE IF NOT EXISTS platform_user_invites (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES platform_users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  accepted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_platform_user_invites_user ON platform_user_invites(user_id);
CREATE INDEX IF NOT EXISTS idx_platform_user_invites_expires ON platform_user_invites(expires_at);

-- Owner activity monitoring
CREATE TABLE IF NOT EXISTS platform_activity_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES platform_users(id) ON DELETE SET NULL,
  actor_name TEXT,
  actor_email TEXT,
  action TEXT NOT NULL,
  resource TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_platform_activity_created ON platform_activity_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_platform_activity_user ON platform_activity_log(user_id);

ALTER TABLE platform_user_invites ENABLE ROW LEVEL SECURITY;
ALTER TABLE platform_activity_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role manages platform_user_invites" ON platform_user_invites;
CREATE POLICY "Service role manages platform_user_invites"
  ON platform_user_invites FOR ALL USING (false) WITH CHECK (false);

DROP POLICY IF EXISTS "Service role manages platform_activity_log" ON platform_activity_log;
CREATE POLICY "Service role manages platform_activity_log"
  ON platform_activity_log FOR ALL USING (false) WITH CHECK (false);


-- ─── 015_site_content.sql ───
-- Site content CMS: structured JSON per public page section

CREATE TABLE IF NOT EXISTS site_content (
  section TEXT PRIMARY KEY,
  content JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE site_content ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "site_content_deny_all" ON site_content;
CREATE POLICY "site_content_deny_all" ON site_content
  FOR ALL USING (false) WITH CHECK (false);


-- ─── 016_platform_team_messages.sql ───
-- Internal team messaging between platform users (owner, managers, staff)

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS platform_conversations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_platform_conversations_updated
  ON platform_conversations(updated_at DESC);

CREATE TABLE IF NOT EXISTS platform_conversation_members (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  conversation_id UUID NOT NULL REFERENCES platform_conversations(id) ON DELETE CASCADE,
  user_id UUID REFERENCES platform_users(id) ON DELETE CASCADE,
  is_owner BOOLEAN NOT NULL DEFAULT false,
  last_read_at TIMESTAMPTZ,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT platform_conversation_members_participant_check
    CHECK (is_owner = true OR user_id IS NOT NULL),
  CONSTRAINT platform_conversation_members_user_unique
    UNIQUE (conversation_id, user_id)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_platform_conversation_members_owner
  ON platform_conversation_members(conversation_id)
  WHERE is_owner = true;

CREATE INDEX IF NOT EXISTS idx_platform_conversation_members_user
  ON platform_conversation_members(user_id)
  WHERE user_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS platform_messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  conversation_id UUID NOT NULL REFERENCES platform_conversations(id) ON DELETE CASCADE,
  sender_user_id UUID REFERENCES platform_users(id) ON DELETE SET NULL,
  sender_is_owner BOOLEAN NOT NULL DEFAULT false,
  sender_name TEXT NOT NULL,
  sender_email TEXT NOT NULL,
  body TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT platform_messages_sender_check
    CHECK (sender_is_owner = true OR sender_user_id IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS idx_platform_messages_conversation
  ON platform_messages(conversation_id, created_at ASC);

ALTER TABLE platform_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE platform_conversation_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE platform_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role manages platform_conversations" ON platform_conversations;
CREATE POLICY "Service role manages platform_conversations"
  ON platform_conversations FOR ALL USING (false) WITH CHECK (false);

DROP POLICY IF EXISTS "Service role manages platform_conversation_members" ON platform_conversation_members;
CREATE POLICY "Service role manages platform_conversation_members"
  ON platform_conversation_members FOR ALL USING (false) WITH CHECK (false);

DROP POLICY IF EXISTS "Service role manages platform_messages" ON platform_messages;
CREATE POLICY "Service role manages platform_messages"
  ON platform_messages FOR ALL USING (false) WITH CHECK (false);


-- ─── 016_site_content_videos_storage.sql ───
-- Extend vehicle-images bucket for site content videos (MP4/WebM up to 50MB)
-- Idempotent: creates the bucket if 011 was never run, or updates limits/mime types.

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'vehicle-images',
  'vehicle-images',
  true,
  52428800,
  ARRAY[
    'image/jpeg',
    'image/png',
    'image/webp',
    'video/mp4',
    'video/webm'
  ]
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;


-- ─── 017_platform_team_channels.sql ───
-- All-staff channel and custom staff groups for platform team chat

ALTER TABLE platform_conversations
  ADD COLUMN IF NOT EXISTS channel_type TEXT NOT NULL DEFAULT 'direct'
    CHECK (channel_type IN ('direct', 'all_staff', 'group')),
  ADD COLUMN IF NOT EXISTS name TEXT,
  ADD COLUMN IF NOT EXISTS created_by_user_id UUID REFERENCES platform_users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS created_by_is_owner BOOLEAN NOT NULL DEFAULT false;

CREATE UNIQUE INDEX IF NOT EXISTS idx_platform_conversations_all_staff
  ON platform_conversations ((true))
  WHERE channel_type = 'all_staff';

CREATE INDEX IF NOT EXISTS idx_platform_conversations_channel_type
  ON platform_conversations(channel_type, updated_at DESC);

-- Seed the company-wide all-staff channel
INSERT INTO platform_conversations (channel_type, name)
SELECT 'all_staff', 'All Staff'
WHERE NOT EXISTS (
  SELECT 1 FROM platform_conversations WHERE channel_type = 'all_staff'
);


-- ─── 018_platform_team_realtime_notifications.sql ───
-- Team chat realtime publication + per-recipient admin notifications

-- Target notifications to specific platform users (owner or staff). NULL recipient = global (legacy).
ALTER TABLE admin_notifications
  ADD COLUMN IF NOT EXISTS recipient_user_id UUID REFERENCES platform_users(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS recipient_is_owner BOOLEAN NOT NULL DEFAULT false;

DROP INDEX IF EXISTS idx_admin_notifications_source;
CREATE UNIQUE INDEX IF NOT EXISTS idx_admin_notifications_source_recipient
  ON admin_notifications (
    source_table,
    source_id,
    COALESCE(recipient_user_id::text, ''),
    recipient_is_owner
  )
  WHERE source_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_admin_notifications_recipient_user
  ON admin_notifications (recipient_user_id, created_at DESC)
  WHERE recipient_user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_admin_notifications_recipient_owner
  ON admin_notifications (created_at DESC)
  WHERE recipient_is_owner = true;

-- Enable Supabase Realtime on team messages and notifications (idempotent).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'platform_messages'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE platform_messages;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'admin_notifications'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE admin_notifications;
  END IF;
END $$;


-- ─── 018_preorder_account_linking_fix.sql ───
-- Ensure pre-order account linking columns and profile trigger are present (idempotent)

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

UPDATE profiles
SET registration_id = generate_registration_id()
WHERE registration_id IS NULL;

UPDATE profiles p
SET email = u.email
FROM auth.users u
WHERE p.id = u.id AND (p.email IS NULL OR p.email = '');

ALTER TABLE preorder_inquiries
  ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS customer_registration_id TEXT;

CREATE INDEX IF NOT EXISTS idx_preorder_inquiries_user
  ON preorder_inquiries(user_id);

CREATE INDEX IF NOT EXISTS idx_preorder_inquiries_registration_id
  ON preorder_inquiries(customer_registration_id);

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

DROP TRIGGER IF EXISTS on_auth_customer_created ON auth.users;
CREATE TRIGGER on_auth_customer_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_customer();

DROP POLICY IF EXISTS "Users can view own preorder inquiries" ON preorder_inquiries;
CREATE POLICY "Users can view own preorder inquiries"
  ON preorder_inquiries FOR SELECT
  USING (
    auth.uid() = user_id
    OR lower(email) = lower(COALESCE(auth.jwt() ->> 'email', ''))
  );


-- ─── 019_customer_conversations.sql ───
-- Two-way customer ↔ staff conversations (threaded chat)

-- 1. Ensure profiles.registration_id exists BEFORE any backfill (self-contained; safe if 013/018 were skipped)
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS registration_id TEXT;

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

UPDATE profiles
SET registration_id = generate_registration_id()
WHERE registration_id IS NULL;

-- 2. Conversation tables
CREATE TABLE IF NOT EXISTS customer_conversations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  customer_name TEXT NOT NULL,
  customer_email TEXT NOT NULL,
  registration_id TEXT,
  subject TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'general',
  status TEXT NOT NULL DEFAULT 'open',
  created_by TEXT NOT NULL DEFAULT 'customer',
  customer_last_read_at TIMESTAMPTZ,
  staff_last_read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT customer_conversations_category_check
    CHECK (category IN ('general', 'pre-order', 'financing', 'processing')),
  CONSTRAINT customer_conversations_status_check
    CHECK (status IN ('new', 'open', 'replied', 'closed')),
  CONSTRAINT customer_conversations_created_by_check
    CHECK (created_by IN ('customer', 'staff'))
);

CREATE INDEX IF NOT EXISTS idx_customer_conversations_user
  ON customer_conversations(user_id, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_customer_conversations_status
  ON customer_conversations(status, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_customer_conversations_updated
  ON customer_conversations(updated_at DESC);

CREATE TABLE IF NOT EXISTS customer_conversation_messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  conversation_id UUID NOT NULL REFERENCES customer_conversations(id) ON DELETE CASCADE,
  sender_type TEXT NOT NULL,
  sender_user_id UUID REFERENCES platform_users(id) ON DELETE SET NULL,
  sender_is_owner BOOLEAN NOT NULL DEFAULT false,
  sender_name TEXT NOT NULL,
  body TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT customer_conversation_messages_sender_type_check
    CHECK (sender_type IN ('customer', 'staff')),
  CONSTRAINT customer_conversation_messages_staff_sender_check
    CHECK (
      sender_type = 'customer'
      OR sender_is_owner = true
      OR sender_user_id IS NOT NULL
    )
);

CREATE INDEX IF NOT EXISTS idx_customer_conversation_messages_thread
  ON customer_conversation_messages(conversation_id, created_at ASC);

-- 3. Migrate legacy single-reply tickets into threaded conversations (only if customer_messages exists)
DO $$
BEGIN
  IF to_regclass('public.customer_messages') IS NOT NULL THEN
    EXECUTE $migrate$
      INSERT INTO customer_conversations (
        id,
        user_id,
        customer_name,
        customer_email,
        subject,
        category,
        status,
        created_by,
        staff_last_read_at,
        created_at,
        updated_at
      )
      SELECT
        cm.id,
        cm.user_id,
        cm.name,
        cm.email,
        cm.subject,
        cm.category,
        cm.status,
        'customer',
        CASE WHEN cm.admin_reply IS NOT NULL AND cm.admin_reply <> '' THEN cm.updated_at ELSE NULL END,
        cm.created_at,
        cm.updated_at
      FROM customer_messages cm
      WHERE NOT EXISTS (
        SELECT 1 FROM customer_conversations cc WHERE cc.id = cm.id
      )
    $migrate$;

    EXECUTE $migrate$
      INSERT INTO customer_conversation_messages (
        conversation_id,
        sender_type,
        sender_name,
        body,
        created_at
      )
      SELECT
        cm.id,
        'customer',
        cm.name,
        cm.body,
        cm.created_at
      FROM customer_messages cm
      WHERE NOT EXISTS (
        SELECT 1
        FROM customer_conversation_messages ccm
        WHERE ccm.conversation_id = cm.id AND ccm.sender_type = 'customer'
      )
    $migrate$;

    EXECUTE $migrate$
      INSERT INTO customer_conversation_messages (
        conversation_id,
        sender_type,
        sender_is_owner,
        sender_name,
        body,
        created_at
      )
      SELECT
        cm.id,
        'staff',
        true,
        'Team',
        cm.admin_reply,
        cm.updated_at
      FROM customer_messages cm
      WHERE cm.admin_reply IS NOT NULL
        AND cm.admin_reply <> ''
        AND NOT EXISTS (
          SELECT 1
          FROM customer_conversation_messages ccm
          WHERE ccm.conversation_id = cm.id AND ccm.sender_type = 'staff'
        )
    $migrate$;
  END IF;
END $$;

-- 4. Backfill customer_conversations.registration_id from profiles
UPDATE customer_conversations cc
SET registration_id = p.registration_id
FROM profiles p
WHERE p.id = cc.user_id
  AND cc.registration_id IS NULL
  AND p.registration_id IS NOT NULL;

-- 5. RLS, trigger, realtime
ALTER TABLE customer_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer_conversation_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role manages customer_conversations" ON customer_conversations;
CREATE POLICY "Service role manages customer_conversations"
  ON customer_conversations FOR ALL USING (false) WITH CHECK (false);

DROP POLICY IF EXISTS "Service role manages customer_conversation_messages" ON customer_conversation_messages;
CREATE POLICY "Service role manages customer_conversation_messages"
  ON customer_conversation_messages FOR ALL USING (false) WITH CHECK (false);

DROP POLICY IF EXISTS "Customers view own conversations" ON customer_conversations;
CREATE POLICY "Customers view own conversations"
  ON customer_conversations FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Customers view own conversation messages" ON customer_conversation_messages;
CREATE POLICY "Customers view own conversation messages"
  ON customer_conversation_messages FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM customer_conversations c
      WHERE c.id = conversation_id AND c.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Customers insert own conversation messages" ON customer_conversation_messages;
CREATE POLICY "Customers insert own conversation messages"
  ON customer_conversation_messages FOR INSERT
  WITH CHECK (
    sender_type = 'customer'
    AND EXISTS (
      SELECT 1 FROM customer_conversations c
      WHERE c.id = conversation_id AND c.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Customers insert own conversations" ON customer_conversations;
CREATE POLICY "Customers insert own conversations"
  ON customer_conversations FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP TRIGGER IF EXISTS trg_customer_conversations_updated ON customer_conversations;
CREATE TRIGGER trg_customer_conversations_updated
  BEFORE UPDATE ON customer_conversations
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'customer_conversation_messages'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE customer_conversation_messages;
  END IF;
END $$;


-- ─── 020_support_tickets.sql ───
-- Support ticket assignment on customer conversations (claim, handoff, reopen)
-- REQUIRES: 019_customer_conversations.sql completed successfully first.

ALTER TABLE customer_conversations
  ADD COLUMN IF NOT EXISTS preorder_id UUID REFERENCES preorder_inquiries(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS assigned_to_user_id UUID REFERENCES platform_users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS assigned_to_is_owner BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS claimed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS closed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS closed_by_user_id UUID REFERENCES platform_users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS closed_by_is_owner BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS resolution_note TEXT;

CREATE INDEX IF NOT EXISTS idx_customer_conversations_queue
  ON customer_conversations(status, updated_at DESC)
  WHERE status IN ('open', 'available');

CREATE INDEX IF NOT EXISTS idx_customer_conversations_assigned
  ON customer_conversations(assigned_to_user_id, assigned_to_is_owner, status);

CREATE INDEX IF NOT EXISTS idx_customer_conversations_preorder
  ON customer_conversations(preorder_id)
  WHERE preorder_id IS NOT NULL;

-- Migrate legacy statuses into ticket workflow
ALTER TABLE customer_conversations
  DROP CONSTRAINT IF EXISTS customer_conversations_status_check;

UPDATE customer_conversations
SET status = 'open'
WHERE status = 'new';

UPDATE customer_conversations
SET status = 'claimed', claimed_at = COALESCE(claimed_at, updated_at)
WHERE status = 'replied';

ALTER TABLE customer_conversations
  ADD CONSTRAINT customer_conversations_status_check
  CHECK (status IN ('open', 'claimed', 'closed', 'available'));

-- Atomic first-accept claim (prevents race when two staff click Accept)
CREATE OR REPLACE FUNCTION public.claim_support_ticket(
  p_ticket_id UUID,
  p_claimer_user_id UUID,
  p_claimer_is_owner BOOLEAN
)
RETURNS SETOF customer_conversations
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  UPDATE customer_conversations
  SET
    status = 'claimed',
    assigned_to_user_id = CASE WHEN p_claimer_is_owner THEN NULL ELSE p_claimer_user_id END,
    assigned_to_is_owner = p_claimer_is_owner,
    claimed_at = NOW(),
    updated_at = NOW(),
    closed_at = NULL,
    closed_by_user_id = NULL,
    closed_by_is_owner = false,
    resolution_note = NULL
  WHERE id = p_ticket_id
    AND status IN ('open', 'available')
    AND assigned_to_user_id IS NULL
    AND assigned_to_is_owner = false
  RETURNING *;
END;
$$;

-- Reopen a closed ticket back to the queue
CREATE OR REPLACE FUNCTION public.reopen_support_ticket(p_ticket_id UUID)
RETURNS SETOF customer_conversations
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  UPDATE customer_conversations
  SET
    status = 'available',
    assigned_to_user_id = NULL,
    assigned_to_is_owner = false,
    claimed_at = NULL,
    closed_at = NULL,
    closed_by_user_id = NULL,
    closed_by_is_owner = false,
    resolution_note = NULL,
    updated_at = NOW()
  WHERE id = p_ticket_id
    AND status = 'closed'
  RETURNING *;
END;
$$;


-- ─── 021_fix_registration_id_reference.sql ───
-- Fix partial 019 failure: profiles.registration_id missing when backfill ran.
-- Idempotent — safe to re-run after a failed 019_customer_conversations migration.
--
-- If customer_conversations does NOT exist (019 rolled back entirely), run
-- supabase/migrations/RUN_019_COMPLETE.sql in the Supabase SQL Editor first.

-- Ensure profiles has registration_id (from 013/018)
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS registration_id TEXT;

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

UPDATE profiles
SET registration_id = generate_registration_id()
WHERE registration_id IS NULL;

-- Steps below require customer_conversations (skip if 019 rolled back — use RUN_019_COMPLETE.sql)
DO $$
BEGIN
  IF to_regclass('public.customer_conversations') IS NULL THEN
    RAISE NOTICE '021 skipped: customer_conversations missing. Run RUN_019_COMPLETE.sql first.';
    RETURN;
  END IF;

  UPDATE customer_conversations cc
  SET registration_id = p.registration_id
  FROM profiles p
  WHERE p.id = cc.user_id
    AND cc.registration_id IS NULL
    AND p.registration_id IS NOT NULL;

  ALTER TABLE customer_conversations ENABLE ROW LEVEL SECURITY;
  ALTER TABLE customer_conversation_messages ENABLE ROW LEVEL SECURITY;

  DROP POLICY IF EXISTS "Service role manages customer_conversations" ON customer_conversations;
  CREATE POLICY "Service role manages customer_conversations"
    ON customer_conversations FOR ALL USING (false) WITH CHECK (false);

  DROP POLICY IF EXISTS "Service role manages customer_conversation_messages" ON customer_conversation_messages;
  CREATE POLICY "Service role manages customer_conversation_messages"
    ON customer_conversation_messages FOR ALL USING (false) WITH CHECK (false);

  DROP POLICY IF EXISTS "Customers view own conversations" ON customer_conversations;
  CREATE POLICY "Customers view own conversations"
    ON customer_conversations FOR SELECT USING (auth.uid() = user_id);

  DROP POLICY IF EXISTS "Customers view own conversation messages" ON customer_conversation_messages;
  CREATE POLICY "Customers view own conversation messages"
    ON customer_conversation_messages FOR SELECT
    USING (
      EXISTS (
        SELECT 1 FROM customer_conversations c
        WHERE c.id = conversation_id AND c.user_id = auth.uid()
      )
    );

  DROP POLICY IF EXISTS "Customers insert own conversation messages" ON customer_conversation_messages;
  CREATE POLICY "Customers insert own conversation messages"
    ON customer_conversation_messages FOR INSERT
    WITH CHECK (
      sender_type = 'customer'
      AND EXISTS (
        SELECT 1 FROM customer_conversations c
        WHERE c.id = conversation_id AND c.user_id = auth.uid()
      )
    );

  DROP POLICY IF EXISTS "Customers insert own conversations" ON customer_conversations;
  CREATE POLICY "Customers insert own conversations"
    ON customer_conversations FOR INSERT WITH CHECK (auth.uid() = user_id);

  DROP TRIGGER IF EXISTS trg_customer_conversations_updated ON customer_conversations;
  CREATE TRIGGER trg_customer_conversations_updated
    BEFORE UPDATE ON customer_conversations
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'customer_conversation_messages'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE customer_conversation_messages;
  END IF;
END $$;


-- ─── 022_fix_preorder_notify_trigger.sql ───
-- Fix pre-order inserts failing when notify_admin_inquiry trigger errors.
-- Root cause: trigger referenced unassigned RECORD v_vehicle when vehicle_id is null
-- or vehicle row is missing, rolling back the entire pre-order insert.
-- Also adds missing account-linking columns (from 018) if not yet applied.

-- ─── Account linking columns (idempotent, from 018) ─────────────────────────
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

ALTER TABLE preorder_inquiries
  ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS customer_registration_id TEXT,
  ADD COLUMN IF NOT EXISTS vehicle_slug TEXT,
  ADD COLUMN IF NOT EXISTS vehicle_title TEXT,
  ADD COLUMN IF NOT EXISTS vehicle_price_usd INTEGER,
  ADD COLUMN IF NOT EXISTS payment_status TEXT DEFAULT 'pending';

CREATE INDEX IF NOT EXISTS idx_preorder_inquiries_user
  ON preorder_inquiries(user_id);

CREATE INDEX IF NOT EXISTS idx_preorder_inquiries_registration_id
  ON preorder_inquiries(customer_registration_id);

ALTER TABLE admin_notifications
  ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS recipient_user_id UUID,
  ADD COLUMN IF NOT EXISTS recipient_is_owner BOOLEAN NOT NULL DEFAULT false;

-- ─── Safe notification trigger (no unassigned RECORD, no brittle ON CONFLICT) ─
CREATE OR REPLACE FUNCTION notify_admin_inquiry()
RETURNS TRIGGER AS $$
DECLARE
  v_type TEXT;
  v_title TEXT;
  v_message TEXT;
  v_link TEXT;
  v_name TEXT;
  v_metadata JSONB := '{}'::jsonb;
  v_vehicle_title TEXT;
  v_image TEXT;
  v_vid UUID;
  v_vyear INT;
  v_vmake TEXT;
  v_vmodel TEXT;
  v_vslug TEXT;
  v_vprice INT;
  v_vstatus TEXT;
  v_vtrim TEXT;
  v_found BOOLEAN := false;
BEGIN
  v_type := TG_ARGV[0];
  v_link := TG_ARGV[1];

  IF TG_TABLE_NAME = 'preorder_inquiries' THEN
    v_name := NEW.name;

    IF NEW.vehicle_id IS NOT NULL THEN
      SELECT
        v.id, v.year, v.make, v.model, v.slug, v.price, v.status, v.trim,
        CASE
          WHEN v.images IS NOT NULL AND array_length(v.images, 1) > 0 THEN v.images[1]
          ELSE NULL
        END
      INTO
        v_vid, v_vyear, v_vmake, v_vmodel, v_vslug, v_vprice, v_vstatus, v_vtrim, v_image
      FROM vehicles v
      WHERE v.id = NEW.vehicle_id;

      v_found := FOUND;
    END IF;

    v_vehicle_title := COALESCE(
      NEW.vehicle_title,
      CASE
        WHEN v_found THEN trim(concat_ws(' ', v_vyear::text, v_vmake, v_vmodel, v_vtrim))
        ELSE NULL
      END,
      'Unknown vehicle'
    );

    v_title := 'Pre-order: ' || v_vehicle_title;
    v_message := v_name || ' · ' || v_vehicle_title || ' · $'
      || to_char(COALESCE(NEW.down_payment_usd, 0), 'FM999,999') || ' down';
    v_link := '/platform/leads/preorder/' || NEW.id::text;

    v_metadata := jsonb_build_object(
      'customer', jsonb_build_object(
        'name', NEW.name,
        'email', NEW.email,
        'phone', NEW.phone,
        'message', NEW.message
      ),
      'vehicle', jsonb_build_object(
        'id', COALESCE(NEW.vehicle_id::text, CASE WHEN v_found THEN v_vid::text ELSE NULL END),
        'year', CASE WHEN v_found THEN v_vyear ELSE NULL END,
        'make', CASE WHEN v_found THEN v_vmake ELSE NULL END,
        'model', CASE WHEN v_found THEN v_vmodel ELSE NULL END,
        'slug', COALESCE(NEW.vehicle_slug, CASE WHEN v_found THEN v_vslug ELSE NULL END),
        'price', COALESCE(NEW.vehicle_price_usd, CASE WHEN v_found THEN v_vprice ELSE NULL END),
        'image', v_image,
        'title', v_vehicle_title,
        'status', CASE WHEN v_found THEN v_vstatus ELSE NULL END
      ),
      'downPaymentUsd', NEW.down_payment_usd,
      'downPaymentFormatted', '$' || to_char(COALESCE(NEW.down_payment_usd, 0), 'FM999,999'),
      'paymentStatus', COALESCE(NEW.payment_status, 'pending')
    );

  ELSIF TG_TABLE_NAME = 'vehicle_inquiries' THEN
    v_name := NEW.name;
    v_title := 'New vehicle inquiry';
    v_message := v_name || ' inquired about ' || COALESCE(NEW.vehicle_name, NEW.vehicle_slug, 'a vehicle');
  ELSIF TG_TABLE_NAME = 'contact_inquiries' THEN
    v_name := NEW.name;
    v_title := 'New contact message';
    v_message := v_name || ': ' || LEFT(COALESCE(NEW.subject, NEW.message, ''), 80);
  ELSIF TG_TABLE_NAME = 'finance_applications' THEN
    v_name := NEW.first_name || ' ' || NEW.last_name;
    v_title := 'New finance application';
    v_message := TRIM(v_name) || ' applied for financing';
  ELSIF TG_TABLE_NAME = 'appraisal_requests' THEN
    v_name := NEW.seller_name;
    v_title := 'New appraisal request';
    v_message := v_name || ' wants to sell a ' || NEW.year || ' ' || NEW.make || ' ' || NEW.model;
  ELSE
    RETURN NEW;
  END IF;

  BEGIN
    INSERT INTO admin_notifications (type, title, message, link, source_table, source_id, metadata)
    VALUES (v_type, v_title, v_message, v_link, TG_TABLE_NAME, NEW.id, v_metadata);
  EXCEPTION
    WHEN unique_violation THEN
      NULL;
    WHEN undefined_column THEN
      INSERT INTO admin_notifications (type, title, message, link, source_table, source_id)
      VALUES (v_type, v_title, v_message, v_link, TG_TABLE_NAME, NEW.id);
  END;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_notify_preorder ON preorder_inquiries;
CREATE TRIGGER trg_notify_preorder
  AFTER INSERT ON preorder_inquiries
  FOR EACH ROW EXECUTE FUNCTION notify_admin_inquiry('preorder', '/platform/leads?tab=preorder');

DROP POLICY IF EXISTS "Users can view own preorder inquiries" ON preorder_inquiries;
CREATE POLICY "Users can view own preorder inquiries"
  ON preorder_inquiries FOR SELECT
  USING (
    auth.uid() = user_id
    OR lower(email) = lower(COALESCE(auth.jwt() ->> 'email', ''))
  );


-- ─── 023_vehicle_approval.sql ───
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


-- ─── 024_fix_deleted_sender_messages.sql ───
-- Preserve message history when platform users are deleted.
-- ON DELETE SET NULL clears sender_user_id, which violated sender check constraints
-- for staff messages (sender_is_owner = false AND sender_user_id IS NULL).

ALTER TABLE platform_messages
  ADD COLUMN IF NOT EXISTS sender_anonymized BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE customer_conversation_messages
  ADD COLUMN IF NOT EXISTS sender_anonymized BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE platform_messages
  DROP CONSTRAINT IF EXISTS platform_messages_sender_check;

ALTER TABLE platform_messages
  ADD CONSTRAINT platform_messages_sender_check
  CHECK (
    sender_is_owner = true
    OR sender_user_id IS NOT NULL
    OR sender_anonymized = true
  );

ALTER TABLE customer_conversation_messages
  DROP CONSTRAINT IF EXISTS customer_conversation_messages_staff_sender_check;

ALTER TABLE customer_conversation_messages
  ADD CONSTRAINT customer_conversation_messages_staff_sender_check
  CHECK (
    sender_type = 'customer'
    OR sender_is_owner = true
    OR sender_user_id IS NOT NULL
    OR sender_anonymized = true
  );

CREATE OR REPLACE FUNCTION anonymize_platform_user_messages()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE platform_messages
  SET sender_anonymized = true
  WHERE sender_user_id = OLD.id;

  UPDATE customer_conversation_messages
  SET sender_anonymized = true
  WHERE sender_user_id = OLD.id;

  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS anonymize_messages_before_platform_user_delete ON platform_users;

CREATE TRIGGER anonymize_messages_before_platform_user_delete
  BEFORE DELETE ON platform_users
  FOR EACH ROW
  EXECUTE FUNCTION anonymize_platform_user_messages();


-- ─── 025_invite_token_plain.sql ───
-- Plain invite token for owner-only link retrieval (validation still uses token_hash; RLS blocks client access)
ALTER TABLE platform_user_invites
  ADD COLUMN IF NOT EXISTS token_plain TEXT;


-- ─── 026_platform_production_schema_fixes.sql ───
-- Production schema fixes (idempotent): invite link retrieval + deleted-user message anonymization.
-- Safe to run even if 024_fix_deleted_sender_messages.sql and 025_invite_token_plain.sql were already applied.

ALTER TABLE platform_user_invites
  ADD COLUMN IF NOT EXISTS token_plain TEXT;

ALTER TABLE platform_messages
  ADD COLUMN IF NOT EXISTS sender_anonymized BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE customer_conversation_messages
  ADD COLUMN IF NOT EXISTS sender_anonymized BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE platform_messages
  DROP CONSTRAINT IF EXISTS platform_messages_sender_check;

ALTER TABLE platform_messages
  ADD CONSTRAINT platform_messages_sender_check
  CHECK (
    sender_is_owner = true
    OR sender_user_id IS NOT NULL
    OR sender_anonymized = true
  );

ALTER TABLE customer_conversation_messages
  DROP CONSTRAINT IF EXISTS customer_conversation_messages_staff_sender_check;

ALTER TABLE customer_conversation_messages
  ADD CONSTRAINT customer_conversation_messages_staff_sender_check
  CHECK (
    sender_type = 'customer'
    OR sender_is_owner = true
    OR sender_user_id IS NOT NULL
    OR sender_anonymized = true
  );

CREATE OR REPLACE FUNCTION anonymize_platform_user_messages()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE platform_messages
  SET sender_anonymized = true
  WHERE sender_user_id = OLD.id;

  UPDATE customer_conversation_messages
  SET sender_anonymized = true
  WHERE sender_user_id = OLD.id;

  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS anonymize_messages_before_platform_user_delete ON platform_users;

CREATE TRIGGER anonymize_messages_before_platform_user_delete
  BEFORE DELETE ON platform_users
  FOR EACH ROW
  EXECUTE FUNCTION anonymize_platform_user_messages();


-- ─── 027_vehicle_pending_changes.sql ───
-- Store manager edit proposals separately from live inventory so rejection
-- does not hide or corrupt published listings.

ALTER TABLE vehicles
  ADD COLUMN IF NOT EXISTS pending_changes JSONB;

COMMENT ON COLUMN vehicles.pending_changes IS
  'Proposed field updates awaiting owner approval. NULL for new listings pending first publish.';

-- Public site: approved listings, plus live rows with pending edits (original data stays visible).
DROP POLICY IF EXISTS "Vehicles are publicly readable" ON vehicles;
CREATE POLICY "Vehicles are publicly readable"
  ON vehicles FOR SELECT
  USING (
    status IN ('available', 'pre_order')
    AND (
      approval_status = 'approved'
      OR (approval_status = 'pending_approval' AND pending_changes IS NOT NULL)
    )
  );


-- ─── 028_company_expansion_foundation.sql ───
-- True Goshen Company Limited v2.0 expansion — foundational schema
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
    '{"title":"Clearing & customs notice","body":"Clearing fees, duties, and port charges vary by shipment type, vehicle value, and Ghana Customs assessment. True Goshen will provide a detailed breakdown before you commit. Contact our freight team for a personalised quote — prices are not fixed on this notice."}'::jsonb
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
    'Clearing fees, duties, and port charges vary by shipment type, vehicle value, and Ghana Customs assessment. True Goshen will provide a detailed breakdown before you commit. Contact our freight team for a personalised quote — prices are not fixed on this notice.'
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


-- ─── 029_corporate_testimonial_names.sql ───
-- Differentiate corporate homepage testimonial names from auto division defaults.
-- Only renames items that still use the auto-division duplicate names.

UPDATE site_content
SET
  content = jsonb_set(
    content,
    '{items}',
    (
      SELECT COALESCE(
        jsonb_agg(
          CASE
            WHEN elem->>'name' = 'Kwame Asante' THEN jsonb_set(elem, '{name}', '"Samuel Boateng"')
            WHEN elem->>'name' = 'Ama Osei' THEN jsonb_set(elem, '{name}', '"Grace Adjei"')
            WHEN elem->>'name' = 'David Martinez' THEN jsonb_set(elem, '{name}', '"Emmanuel Darko"')
            WHEN elem->>'name' = 'Jennifer Mensah' THEN jsonb_set(elem, '{name}', '"Patricia Owusu"')
            ELSE elem
          END
          ORDER BY ord
        ),
        content->'items'
      )
      FROM jsonb_array_elements(content->'items') WITH ORDINALITY AS t(elem, ord)
    )
  ),
  updated_at = NOW()
WHERE section = 'corporate_testimonials'
  AND jsonb_typeof(content->'items') = 'array'
  AND content->'items' @> ANY (
    ARRAY[
      '[{"name": "Kwame Asante"}]'::jsonb,
      '[{"name": "Ama Osei"}]'::jsonb,
      '[{"name": "David Martinez"}]'::jsonb,
      '[{"name": "Jennifer Mensah"}]'::jsonb
    ]
  );


-- ─── 030_cms_content_keys.sql ───
-- Corporate CMS content keys for site_content (idempotent seed).
-- Defaults in src/lib/site-content/corporate-defaults.ts apply when rows are absent.

INSERT INTO site_content (section, content) VALUES
  ('corporate_homepage', '{}'::jsonb),
  ('corporate_services', '{}'::jsonb),
  ('corporate_stats', '{}'::jsonb),
  ('corporate_faq', '{}'::jsonb),
  ('corporate_services_page', '{}'::jsonb),
  ('freight_landing', '{}'::jsonb),
  ('shipping_consultation', '{}'::jsonb),
  ('spare_parts_landing', '{}'::jsonb)
ON CONFLICT (section) DO NOTHING;


-- ─── 031_tracking_cms.sql ───
-- Additional CMS content keys + shipment index (idempotent)

INSERT INTO site_content (section, content) VALUES
  ('corporate_divisions', '{}'::jsonb),
  ('inventory_page', '{}'::jsonb),
  ('freight_tracking', '{}'::jsonb)
ON CONFLICT (section) DO NOTHING;

CREATE INDEX IF NOT EXISTS idx_shipment_tracking_reference
  ON shipment_tracking(reference_type, reference_id);


-- ─── 032_seed_parts_categories_inventory.sql ───
-- Seed auto parts categories and sample inventory (idempotent)
-- Run after 028_company_expansion_foundation.sql

-- Deactivate legacy combined categories from 028 in favour of granular taxonomy
UPDATE parts_categories
SET is_active = false, updated_at = NOW()
WHERE slug IN (
  'engine-drivetrain',
  'brakes-suspension',
  'electrical-lighting',
  'body-exterior',
  'interior-comfort',
  'filters-fluids'
);

-- ─── Categories (12 per product spec) ───────────────────────────────────────────
INSERT INTO parts_categories (name, slug, description, sort_order) VALUES
  ('Engine', 'engine', 'Engine blocks, gaskets, belts, and internal components', 1),
  ('Transmission', 'transmission', 'Gearboxes, clutches, torque converters, and drivetrain', 2),
  ('Suspension', 'suspension', 'Shocks, struts, control arms, and bushings', 3),
  ('Electrical', 'electrical', 'Alternators, starters, wiring, and sensors', 4),
  ('Body Parts', 'body-parts', 'Panels, bumpers, fenders, and structural body components', 5),
  ('Tyres', 'tyres', 'Passenger, SUV, and commercial tyres', 6),
  ('Interior', 'interior', 'Seats, dashboards, trim, and cabin fittings', 7),
  ('Exterior', 'exterior', 'Mirrors, grilles, spoilers, and exterior trim', 8),
  ('Accessories', 'accessories', 'Mats, covers, racks, and convenience add-ons', 9),
  ('Lubricants', 'lubricants', 'Engine oils, gear oils, and specialty fluids', 10),
  ('Filters', 'filters', 'Oil, air, fuel, and cabin air filters', 11),
  ('Batteries', 'batteries', 'Starter batteries and AGM units for all vehicle types', 12)
ON CONFLICT (slug) DO NOTHING;

-- ─── Sample parts (16 total: 12 draft, 4 published) ───────────────────────────
INSERT INTO parts (
  category_id, name, slug, sku, description, price_usd, brand,
  compatible_makes, compatible_models, stock_quantity, status, is_featured
) VALUES
  (
    (SELECT id FROM parts_categories WHERE slug = 'engine'),
    'Toyota 2GR-FE Timing Chain Kit',
    'toyota-2gr-fe-timing-chain-kit',
    '13540-31020',
    'OEM-spec timing chain kit with guides and tensioner. New condition.',
    285, 'Toyota Genuine',
    ARRAY['Toyota'], ARRAY['Camry', 'Highlander', 'RAV4'],
    4, 'draft', false
  ),
  (
    (SELECT id FROM parts_categories WHERE slug = 'engine'),
    'Honda K20 Engine Mount Set',
    'honda-k20-engine-mount-set',
    '50820-SNA-A03',
    'Front and rear engine mounts for K-series engines. Remanufactured, tested.',
    120, 'Honda',
    ARRAY['Honda'], ARRAY['Civic', 'Accord', 'CR-V'],
    8, 'published', true
  ),
  (
    (SELECT id FROM parts_categories WHERE slug = 'transmission'),
    'Toyota A340E Transmission Filter Kit',
    'toyota-a340e-transmission-filter-kit',
    '35330-60030',
    'Transmission filter and pan gasket for A340E automatic gearbox. New.',
    45, 'Toyota Genuine',
    ARRAY['Toyota'], ARRAY['Land Cruiser', 'Prado', 'Hilux'],
    12, 'draft', false
  ),
  (
    (SELECT id FROM parts_categories WHERE slug = 'suspension'),
    'Monroe Front Strut Assembly',
    'monroe-front-strut-assembly',
    'G7392',
    'Complete front strut with coil spring. New OEM-quality replacement.',
    165, 'Monroe',
    ARRAY['Toyota', 'Nissan'], ARRAY['Corolla', 'Altima', 'Sentra'],
    6, 'published', true
  ),
  (
    (SELECT id FROM parts_categories WHERE slug = 'suspension'),
    'KYB Rear Shock Absorber',
    'kyb-rear-shock-absorber',
    '349105',
    'Gas-charged rear shock absorber. New, 1-year warranty.',
    78, 'KYB',
    ARRAY['Honda', 'Toyota'], ARRAY['Civic', 'Corolla'],
    10, 'draft', false
  ),
  (
    (SELECT id FROM parts_categories WHERE slug = 'electrical'),
    'Denso 12V 120A Alternator',
    'denso-12v-120a-alternator',
    '104210-5201',
    'High-output alternator for 2.0–2.4L petrol engines. Remanufactured.',
    195, 'Denso',
    ARRAY['Toyota', 'Honda'], ARRAY['Camry', 'Accord'],
    3, 'draft', false
  ),
  (
    (SELECT id FROM parts_categories WHERE slug = 'electrical'),
    'Bosch H4 Halogen Headlight Bulb Pair',
    'bosch-h4-halogen-headlight-bulb-pair',
    '1987302041',
    'Standard H4 halogen bulbs, 60/55W. New in retail pack.',
    18, 'Bosch',
    ARRAY['Toyota', 'Nissan', 'Honda'], ARRAY['Corolla', 'Sentra', 'Civic'],
    24, 'draft', false
  ),
  (
    (SELECT id FROM parts_categories WHERE slug = 'body-parts'),
    'Toyota Corolla Front Bumper Cover',
    'toyota-corolla-front-bumper-cover',
    '52119-02F90',
    'Primed front bumper cover, ready for paint. New aftermarket.',
    220, 'Toyota',
    ARRAY['Toyota'], ARRAY['Corolla'],
    2, 'draft', false
  ),
  (
    (SELECT id FROM parts_categories WHERE slug = 'tyres'),
    'Michelin Primacy 4 205/55 R16',
    'michelin-primacy-4-205-55-r16',
    '205/55R16-91V',
    'All-season touring tyre. New, DOT within 12 months.',
    145, 'Michelin',
    ARRAY['Toyota', 'Honda', 'Nissan'], ARRAY['Corolla', 'Civic', 'Altima'],
    16, 'published', true
  ),
  (
    (SELECT id FROM parts_categories WHERE slug = 'interior'),
    'Universal Leather Seat Cover Set',
    'universal-leather-seat-cover-set',
    'TG-INT-SC-001',
    '5-piece PU leather seat cover set, black. New.',
    95, 'Nabus Motors',
    ARRAY['Toyota', 'Honda', 'Nissan'], ARRAY['Corolla', 'Civic', 'Sentra'],
    15, 'draft', false
  ),
  (
    (SELECT id FROM parts_categories WHERE slug = 'exterior'),
    'LED Headlight Assembly Pair',
    'led-headlight-assembly-pair',
    'TG-EXT-HL-002',
    'Aftermarket LED projector headlight assemblies. New.',
    380, 'Depo',
    ARRAY['Toyota'], ARRAY['RAV4', 'Highlander'],
    4, 'draft', false
  ),
  (
    (SELECT id FROM parts_categories WHERE slug = 'accessories'),
    'All-Weather Rubber Floor Mat Set',
    'all-weather-rubber-floor-mat-set',
    'TG-ACC-FM-003',
    '4-piece heavy-duty rubber floor mats, universal fit. New.',
    42, 'Nabus Motors',
    ARRAY['Toyota', 'Honda', 'Nissan'], ARRAY['Corolla', 'Civic', 'Sentra'],
    30, 'draft', false
  ),
  (
    (SELECT id FROM parts_categories WHERE slug = 'lubricants'),
    'Castrol Edge 5W-30 Engine Oil 5L',
    'castrol-edge-5w30-engine-oil-5l',
    '15B1E5',
    'Full synthetic 5W-30 engine oil, 5-litre bottle. New.',
    52, 'Castrol',
    ARRAY['Toyota', 'Honda', 'Mercedes-Benz'], ARRAY['Camry', 'Civic', 'C-Class'],
    40, 'published', false
  ),
  (
    (SELECT id FROM parts_categories WHERE slug = 'filters'),
    'Bosch Oil Filter P7024',
    'bosch-oil-filter-p7024',
    'P7024',
    'Spin-on oil filter for 4-cylinder petrol engines. New.',
    12, 'Bosch',
    ARRAY['Toyota', 'Honda'], ARRAY['Corolla', 'Civic', 'Camry'],
    50, 'draft', false
  ),
  (
    (SELECT id FROM parts_categories WHERE slug = 'filters'),
    'K&N High-Flow Air Filter',
    'kn-high-flow-air-filter',
    '33-2304',
    'Washable high-flow air filter, direct replacement. New.',
    68, 'K&N',
    ARRAY['Toyota'], ARRAY['Land Cruiser', 'Prado'],
    7, 'draft', false
  ),
  (
    (SELECT id FROM parts_categories WHERE slug = 'batteries'),
    'Exide 12V 70Ah Maintenance-Free Battery',
    'exide-12v-70ah-maintenance-free-battery',
    'EB704',
    'Maintenance-free calcium battery, 70Ah / 640CCA. New with 18-month warranty.',
    135, 'Exide',
    ARRAY['Toyota', 'Nissan', 'Honda'], ARRAY['Corolla', 'Altima', 'CR-V'],
    9, 'draft', false
  )
ON CONFLICT (slug) DO NOTHING;


-- ─── 033_cms_auto_tracking_complete.sql ───
-- Complete CMS coverage for Auto Divisions + Tracking form copy (idempotent).
-- Defaults in src/lib/site-content/corporate-defaults.ts apply when fields are absent.

INSERT INTO site_content (section, content) VALUES
  ('corporate_divisions', '{}'::jsonb),
  ('freight_tracking', '{}'::jsonb)
ON CONFLICT (section) DO NOTHING;


-- ─── 033_ensure_spare_parts_cms.sql ───
-- Ensure spare parts landing CMS key exists (idempotent).
-- Defaults in src/lib/site-content/corporate-defaults.ts apply when content is empty.

INSERT INTO site_content (section, content) VALUES
  ('spare_parts_landing', '{}'::jsonb)
ON CONFLICT (section) DO NOTHING;


-- ─── 034_platform_settings_expand.sql ───
-- Expand platform operational settings (site_settings key-value store)

INSERT INTO site_settings (key, value) VALUES
  ('company_legal_name', 'Nabus Motors and Trading'),
  ('tagline', 'Drive Your Dream Car'),
  ('address_line1', 'Accra Metropolitan District'),
  ('address_line2', 'Greater Accra, Ghana'),
  ('google_maps_url', 'https://www.google.com/maps/search/?api=1&query=Nabus+Motors+Accra+Ghana'),
  ('hours_weekday', 'Mon–Fri: 9:00 AM – 7:00 PM'),
  ('hours_saturday', 'Sat: 9:00 AM – 5:00 PM'),
  ('hours_sunday', 'Sun: Closed'),
  ('preorder_terms_a', 'Option A — I will arrange my own shipping and clearing'),
  ('preorder_terms_b', 'Option B — Nabus Motors handles freight forwarding & clearing'),
  ('preorder_terms_c', 'Option C — I need consultation before deciding'),
  ('social_facebook', ''),
  ('social_instagram', ''),
  ('social_linkedin', ''),
  ('default_currency_display', 'GHS'),
  ('inventory_low_stock_threshold', '5'),
  ('appointment_branches', 'Accra'),
  ('freight_default_origins', E'China\nJapan\nUSA\nUnited Kingdom\nUAE'),
  ('freight_quote_notification_email', 'info@nabusmotors.com'),
  ('notify_email_enabled', 'true'),
  ('notify_freight_quotes_enabled', 'true'),
  ('notify_preorders_enabled', 'true'),
  ('notify_low_stock_enabled', 'true'),
  ('maintenance_mode', 'false'),
  ('maintenance_message', 'We are performing scheduled maintenance. Some features may be temporarily unavailable.'),
  ('feature_show_spare_parts_nav', 'true'),
  ('feature_show_freight_nav', 'true')
ON CONFLICT (key) DO NOTHING;


-- ─── 035_backend_connection_verify.sql ───
-- Backend connection verify: public read policies for operational settings
-- Required when the anon Supabase client reads site_settings (pre-order form, layout flags).
-- Server routes may also use the service role; this policy keeps direct anon reads working.

DROP POLICY IF EXISTS "Public operational site_settings are readable" ON site_settings;
CREATE POLICY "Public operational site_settings are readable"
  ON site_settings FOR SELECT
  USING (
    key IN (
      'clearing_fee_notice',
      'preorder_terms_a',
      'preorder_terms_b',
      'preorder_terms_c',
      'maintenance_mode',
      'maintenance_message',
      'freight_default_origins',
      'feature_show_spare_parts_nav',
      'feature_show_freight_nav',
      'phone',
      'email',
      'whatsapp_number',
      'company_name',
      'hours_weekday',
      'hours_saturday',
      'hours_sunday'
    )
  );

-- Verify core backend tables exist (no-op if already present from earlier migrations)
CREATE TABLE IF NOT EXISTS site_content (
  section TEXT PRIMARY KEY,
  content JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS site_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL DEFAULT '',
  updated_at TIMESTAMPTZ DEFAULT NOW()
);


-- ─── 036_freight_quote_notifications.sql ───
-- Freight quote requests: admin notifications + backfill
-- Root cause: migration 028 created freight_quote_requests but no notify trigger,
-- so quotes saved successfully but never appeared in admin_notifications.

CREATE OR REPLACE FUNCTION notify_freight_quote_request()
RETURNS TRIGGER AS $$
DECLARE
  v_service TEXT;
  v_message TEXT;
BEGIN
  v_service := replace(NEW.service_type, '_', ' ');
  v_message := NEW.name || ' requested ' || v_service;
  IF NEW.origin_country IS NOT NULL AND trim(NEW.origin_country) <> '' THEN
    v_message := v_message || ' from ' || trim(NEW.origin_country);
  END IF;

  BEGIN
    INSERT INTO admin_notifications (type, title, message, link, source_table, source_id)
    VALUES (
      'freight_quote',
      'New freight quote request',
      v_message,
      '/platform/freight/quotes',
      'freight_quote_requests',
      NEW.id
    );
  EXCEPTION
    WHEN unique_violation THEN
      NULL;
  END;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_notify_freight_quote ON freight_quote_requests;
CREATE TRIGGER trg_notify_freight_quote
  AFTER INSERT ON freight_quote_requests
  FOR EACH ROW EXECUTE FUNCTION notify_freight_quote_request();

-- Backfill open freight quotes missing from the notification center
INSERT INTO admin_notifications (type, title, message, link, source_table, source_id, created_at)
SELECT
  'freight_quote',
  'New freight quote request',
  f.name || ' requested ' || replace(f.service_type, '_', ' ')
    || CASE
         WHEN f.origin_country IS NOT NULL AND trim(f.origin_country) <> ''
         THEN ' from ' || trim(f.origin_country)
         ELSE ''
       END,
  '/platform/freight/quotes',
  'freight_quote_requests',
  f.id,
  f.created_at
FROM freight_quote_requests f
WHERE f.status IN ('new', 'contacted')
  AND NOT EXISTS (
    SELECT 1
    FROM admin_notifications n
    WHERE n.source_table = 'freight_quote_requests'
      AND n.source_id = f.id
  );


-- ─── 037_freight_quote_conversion.sql ───
-- Link freight quotes to converted shipments and track converted status.

ALTER TABLE freight_quote_requests
  ADD COLUMN IF NOT EXISTS converted_shipment_id UUID REFERENCES shipment_tracking(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_freight_quotes_converted_shipment
  ON freight_quote_requests(converted_shipment_id)
  WHERE converted_shipment_id IS NOT NULL;

ALTER TABLE freight_quote_requests
  DROP CONSTRAINT IF EXISTS freight_quote_requests_status_check;

ALTER TABLE freight_quote_requests
  ADD CONSTRAINT freight_quote_requests_status_check
  CHECK (status IN ('new', 'contacted', 'quoted', 'accepted', 'converted', 'closed', 'cancelled'));

-- Backfill quotes already converted via shipment_tracking.reference_id
UPDATE freight_quote_requests q
SET
  converted_shipment_id = s.id,
  status = 'converted',
  updated_at = NOW()
FROM shipment_tracking s
WHERE s.reference_type = 'freight'
  AND s.reference_id IS NOT NULL
  AND s.reference_id = q.id
  AND q.converted_shipment_id IS NULL;


-- ─── 038_freight_quote_customer_linking.sql ───
-- Freight quote reference codes and customer account linking.

ALTER TABLE freight_quote_requests
  ADD COLUMN IF NOT EXISTS reference_code TEXT,
  ADD COLUMN IF NOT EXISTS customer_registration_id TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_freight_quotes_reference_code
  ON freight_quote_requests(reference_code)
  WHERE reference_code IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_freight_quotes_user_id
  ON freight_quote_requests(user_id)
  WHERE user_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.generate_freight_reference_code()
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
  year_part TEXT := to_char(NOW(), 'YYYY');
  suffix TEXT;
  candidate TEXT;
  attempts INTEGER := 0;
BEGIN
  LOOP
    suffix := upper(substr(md5(random()::text || clock_timestamp()::text), 1, 6));
    candidate := 'FQ-' || year_part || '-' || suffix;
    IF NOT EXISTS (
      SELECT 1 FROM freight_quote_requests WHERE reference_code = candidate
    ) THEN
      RETURN candidate;
    END IF;
    attempts := attempts + 1;
    IF attempts > 20 THEN
      RAISE EXCEPTION 'Could not generate unique freight reference code';
    END IF;
  END LOOP;
END;
$$;

-- Backfill reference codes for existing quotes
UPDATE freight_quote_requests
SET reference_code = generate_freight_reference_code()
WHERE reference_code IS NULL;


-- ─── 039_customer_whatsapp_notifications.sql ───
-- Customer WhatsApp notification preferences and delivery log.

ALTER TABLE freight_quote_requests
  ADD COLUMN IF NOT EXISTS whatsapp_opt_in BOOLEAN DEFAULT NULL;

ALTER TABLE preorder_inquiries
  ADD COLUMN IF NOT EXISTS whatsapp_opt_in BOOLEAN DEFAULT NULL;

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS whatsapp_opt_in BOOLEAN DEFAULT NULL;

CREATE TABLE IF NOT EXISTS notification_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  source_table TEXT,
  source_id TEXT,
  template TEXT NOT NULL,
  channel TEXT NOT NULL CHECK (channel IN ('whatsapp', 'email')),
  status TEXT NOT NULL CHECK (status IN ('sent', 'failed', 'skipped', 'deferred')),
  recipient TEXT NOT NULL,
  detail TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notification_log_source
  ON notification_log(source_table, source_id);

CREATE INDEX IF NOT EXISTS idx_notification_log_created
  ON notification_log(created_at DESC);

ALTER TABLE notification_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role manages notification_log" ON notification_log;
CREATE POLICY "Service role manages notification_log"
  ON notification_log FOR ALL USING (false) WITH CHECK (false);

-- Default Ghana mobile numbers to WhatsApp opt-in
UPDATE freight_quote_requests
SET whatsapp_opt_in = TRUE
WHERE whatsapp_opt_in IS NULL
  AND phone IS NOT NULL
  AND phone ~ '^(\+?233|0)(20|23|24|25|26|27|28|50|53|54|55|56|57|59)';

UPDATE preorder_inquiries
SET whatsapp_opt_in = TRUE
WHERE whatsapp_opt_in IS NULL
  AND phone IS NOT NULL
  AND phone ~ '^(\+?233|0)(20|23|24|25|26|27|28|50|53|54|55|56|57|59)';


-- ─── 040_freight_cargo_fields.sql ───
-- Freight quote cargo type + size fields

ALTER TABLE freight_quote_requests
  ADD COLUMN IF NOT EXISTS cargo_size TEXT;

COMMENT ON COLUMN freight_quote_requests.cargo_description IS 'Cargo type label or custom description';
COMMENT ON COLUMN freight_quote_requests.cargo_size IS 'Selected size, dimensions, or weight details';

DROP POLICY IF EXISTS "Public operational site_settings are readable" ON site_settings;
CREATE POLICY "Public operational site_settings are readable"
  ON site_settings FOR SELECT
  USING (
    key IN (
      'clearing_fee_notice',
      'preorder_terms_a',
      'preorder_terms_b',
      'preorder_terms_c',
      'maintenance_mode',
      'maintenance_message',
      'freight_default_origins',
      'freight_cargo_options',
      'feature_show_spare_parts_nav',
      'feature_show_freight_nav',
      'phone',
      'email',
      'whatsapp_number',
      'company_name',
      'hours_weekday',
      'hours_saturday',
      'hours_sunday'
    )
  );

INSERT INTO site_settings (key, value) VALUES
  (
    'freight_cargo_options',
    $$[
  {
    "value": "vehicle",
    "label": "Vehicle",
    "sizeLabel": "Vehicle type",
    "sizes": [
      { "value": "sedan", "label": "Sedan" },
      { "value": "suv", "label": "SUV" },
      { "value": "truck", "label": "Truck" },
      { "value": "motorcycle", "label": "Motorcycle" }
    ],
    "detailLabel": "Make / model (optional)",
    "detailPlaceholder": "e.g. 2022 Toyota RAV4"
  },
  {
    "value": "container",
    "label": "Container",
    "sizeLabel": "Container size",
    "sizes": [
      { "value": "20ft", "label": "20ft" },
      { "value": "40ft", "label": "40ft" },
      { "value": "40ft_hc", "label": "40ft HC" }
    ]
  },
  {
    "value": "general_cargo",
    "label": "General cargo",
    "sizeLabel": "Size category",
    "sizes": [
      { "value": "small", "label": "Small" },
      { "value": "medium", "label": "Medium" },
      { "value": "large", "label": "Large" }
    ],
    "detailLabel": "Dimensions or weight estimate (optional)",
    "detailPlaceholder": "e.g. 2×1×1 m or ~500 kg"
  },
  {
    "value": "spare_parts",
    "label": "Spare parts shipment",
    "sizeLabel": "Estimated weight",
    "sizes": [
      { "value": "under_50kg", "label": "Under 50 kg" },
      { "value": "50_200kg", "label": "50–200 kg" },
      { "value": "over_200kg", "label": "Over 200 kg" }
    ]
  },
  {
    "value": "documents",
    "label": "Documents only"
  },
  {
    "value": "custom",
    "label": "Custom",
    "custom": true
  }
]$$
  )
ON CONFLICT (key) DO NOTHING;


-- ─── 041_shipment_customer_contact.sql ───
-- Store customer WhatsApp contact on shipment records (copied from quote at conversion).

ALTER TABLE shipment_tracking
  ADD COLUMN IF NOT EXISTS customer_phone TEXT,
  ADD COLUMN IF NOT EXISTS whatsapp_opt_in BOOLEAN DEFAULT NULL;

-- Backfill from linked freight quotes
UPDATE shipment_tracking s
SET
  customer_phone = COALESCE(s.customer_phone, q.phone),
  whatsapp_opt_in = COALESCE(s.whatsapp_opt_in, q.whatsapp_opt_in)
FROM freight_quote_requests q
WHERE s.reference_type = 'freight'
  AND s.reference_id = q.id
  AND (s.customer_phone IS NULL OR s.whatsapp_opt_in IS NULL);

-- Backfill from linked pre-orders
UPDATE shipment_tracking s
SET
  customer_phone = COALESCE(s.customer_phone, p.phone),
  whatsapp_opt_in = COALESCE(s.whatsapp_opt_in, p.whatsapp_opt_in)
FROM preorder_inquiries p
WHERE s.reference_type = 'preorder'
  AND s.reference_id = p.id
  AND (s.customer_phone IS NULL OR s.whatsapp_opt_in IS NULL);

-- Default Ghana mobile numbers to WhatsApp opt-in when still unset
UPDATE shipment_tracking
SET whatsapp_opt_in = TRUE
WHERE whatsapp_opt_in IS NULL
  AND customer_phone IS NOT NULL
  AND customer_phone ~ '^(\+?233|0)(20|23|24|25|26|27|28|50|53|54|55|56|57|59)';


-- ─── 042_shipment_update_frequency.sql ───
-- Shipment customer notification frequency (every_update | milestones_only)
INSERT INTO site_settings (key, value) VALUES
  ('shipment_update_frequency', 'every_update')
ON CONFLICT (key) DO NOTHING;


-- ─── 043_customer_cart.sql ───
-- Customer shopping carts and parts orders

-- ─── Saved carts (logged-in customers) ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS customer_carts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id)
);

CREATE TABLE IF NOT EXISTS cart_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  cart_id UUID NOT NULL REFERENCES customer_carts(id) ON DELETE CASCADE,
  part_id UUID NOT NULL REFERENCES parts(id) ON DELETE CASCADE,
  quantity INTEGER NOT NULL DEFAULT 1 CHECK (quantity > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (cart_id, part_id)
);

CREATE INDEX IF NOT EXISTS idx_cart_items_cart ON cart_items(cart_id);
CREATE INDEX IF NOT EXISTS idx_cart_items_part ON cart_items(part_id);

-- ─── Parts orders (checkout / quote requests) ─────────────────────────────────
CREATE TABLE IF NOT EXISTS parts_orders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  email TEXT NOT NULL,
  name TEXT NOT NULL,
  phone TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  total_usd INTEGER NOT NULL DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE parts_orders
  DROP CONSTRAINT IF EXISTS parts_orders_status_check;

ALTER TABLE parts_orders
  ADD CONSTRAINT parts_orders_status_check
  CHECK (status IN ('pending', 'confirmed', 'fulfilled', 'cancelled'));

CREATE TABLE IF NOT EXISTS parts_order_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id UUID NOT NULL REFERENCES parts_orders(id) ON DELETE CASCADE,
  part_id UUID REFERENCES parts(id) ON DELETE SET NULL,
  part_name TEXT NOT NULL,
  part_slug TEXT,
  sku TEXT,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  unit_price_usd INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_parts_orders_user ON parts_orders(user_id);
CREATE INDEX IF NOT EXISTS idx_parts_orders_email ON parts_orders(email);
CREATE INDEX IF NOT EXISTS idx_parts_order_items_order ON parts_order_items(order_id);

-- ─── updated_at triggers ──────────────────────────────────────────────────────
DROP TRIGGER IF EXISTS trg_customer_carts_updated ON customer_carts;
CREATE TRIGGER trg_customer_carts_updated
  BEFORE UPDATE ON customer_carts
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_cart_items_updated ON cart_items;
CREATE TRIGGER trg_cart_items_updated
  BEFORE UPDATE ON cart_items
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_parts_orders_updated ON parts_orders;
CREATE TRIGGER trg_parts_orders_updated
  BEFORE UPDATE ON parts_orders
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ─── RLS ──────────────────────────────────────────────────────────────────────
ALTER TABLE customer_carts ENABLE ROW LEVEL SECURITY;
ALTER TABLE cart_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE parts_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE parts_order_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role manages customer carts" ON customer_carts;
CREATE POLICY "Service role manages customer carts"
  ON customer_carts FOR ALL USING (false) WITH CHECK (false);

DROP POLICY IF EXISTS "Service role manages cart items" ON cart_items;
CREATE POLICY "Service role manages cart items"
  ON cart_items FOR ALL USING (false) WITH CHECK (false);

DROP POLICY IF EXISTS "Service role manages parts orders" ON parts_orders;
CREATE POLICY "Service role manages parts orders"
  ON parts_orders FOR ALL USING (false) WITH CHECK (false);

DROP POLICY IF EXISTS "Service role manages parts order items" ON parts_order_items;
CREATE POLICY "Service role manages parts order items"
  ON parts_order_items FOR ALL USING (false) WITH CHECK (false);

-- ─── Admin notification on new parts order ────────────────────────────────────
CREATE OR REPLACE FUNCTION notify_parts_order()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO admin_notifications (type, title, message, link, source_table, source_id)
  VALUES (
    'inquiry',
    'New parts order',
    format('%s — total $%s USD', NEW.name, NEW.total_usd),
    '/platform/parts/orders',
    'parts_orders',
    NEW.id
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_parts_order ON parts_orders;
CREATE TRIGGER trg_notify_parts_order
  AFTER INSERT ON parts_orders
  FOR EACH ROW EXECUTE FUNCTION notify_parts_order();


-- ─── 044_preorder_insert_permanent_fix.sql ───
-- Permanent fix for pre-order insert failures (run in Supabase SQL Editor if pre-orders fail).
-- Root cause: notify_admin_inquiry() from 006 accessed an unassigned RECORD when vehicle_id
-- was null or the vehicle row was missing, rolling back the entire pre-order insert.
-- This migration is idempotent and safe to re-run.

-- ─── Schema columns (from 007, 018, 028, 039) ────────────────────────────────
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
  ADD COLUMN IF NOT EXISTS email TEXT,
  ADD COLUMN IF NOT EXISTS whatsapp_opt_in BOOLEAN DEFAULT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_profiles_registration_id
  ON profiles(registration_id)
  WHERE registration_id IS NOT NULL;

ALTER TABLE preorder_inquiries
  ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS customer_registration_id TEXT,
  ADD COLUMN IF NOT EXISTS vehicle_slug TEXT,
  ADD COLUMN IF NOT EXISTS vehicle_title TEXT,
  ADD COLUMN IF NOT EXISTS vehicle_price_usd INTEGER,
  ADD COLUMN IF NOT EXISTS payment_status TEXT DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS shipping_handling TEXT,
  ADD COLUMN IF NOT EXISTS shipping_terms_accepted BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS shipping_terms_accepted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS whatsapp_opt_in BOOLEAN DEFAULT NULL;

ALTER TABLE preorder_inquiries
  DROP CONSTRAINT IF EXISTS preorder_inquiries_payment_status_check;

ALTER TABLE preorder_inquiries
  ADD CONSTRAINT preorder_inquiries_payment_status_check
  CHECK (payment_status IN ('pending', 'down_payment_paid', 'completed', 'cancelled'));

ALTER TABLE preorder_inquiries
  DROP CONSTRAINT IF EXISTS preorder_inquiries_shipping_handling_check;

ALTER TABLE preorder_inquiries
  ADD CONSTRAINT preorder_inquiries_shipping_handling_check
  CHECK (
    shipping_handling IS NULL
    OR shipping_handling IN ('customer_arranged', 'true_goshen', 'consultation')
  );

CREATE INDEX IF NOT EXISTS idx_preorder_inquiries_user
  ON preorder_inquiries(user_id);

CREATE INDEX IF NOT EXISTS idx_preorder_inquiries_registration_id
  ON preorder_inquiries(customer_registration_id);

CREATE INDEX IF NOT EXISTS idx_preorder_inquiries_payment_status
  ON preorder_inquiries(payment_status);

ALTER TABLE admin_notifications
  ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS recipient_user_id UUID,
  ADD COLUMN IF NOT EXISTS recipient_is_owner BOOLEAN NOT NULL DEFAULT false;

-- ─── Profile auto-create on auth signup (guest pre-order account creation) ───
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

DROP TRIGGER IF EXISTS on_auth_customer_created ON auth.users;
CREATE TRIGGER on_auth_customer_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_customer();

-- ─── Safe notification trigger (never rolls back pre-order insert) ───────────
CREATE OR REPLACE FUNCTION notify_admin_inquiry()
RETURNS TRIGGER AS $$
DECLARE
  v_type TEXT;
  v_title TEXT;
  v_message TEXT;
  v_link TEXT;
  v_name TEXT;
  v_metadata JSONB := '{}'::jsonb;
  v_vehicle_title TEXT;
  v_image TEXT;
  v_vid UUID;
  v_vyear INT;
  v_vmake TEXT;
  v_vmodel TEXT;
  v_vslug TEXT;
  v_vprice INT;
  v_vstatus TEXT;
  v_vtrim TEXT;
  v_found BOOLEAN := false;
BEGIN
  v_type := TG_ARGV[0];
  v_link := TG_ARGV[1];

  IF TG_TABLE_NAME = 'preorder_inquiries' THEN
    v_name := NEW.name;

    IF NEW.vehicle_id IS NOT NULL THEN
      SELECT
        v.id, v.year, v.make, v.model, v.slug, v.price, v.status, v.trim,
        CASE
          WHEN v.images IS NOT NULL AND array_length(v.images, 1) > 0 THEN v.images[1]
          ELSE NULL
        END
      INTO
        v_vid, v_vyear, v_vmake, v_vmodel, v_vslug, v_vprice, v_vstatus, v_vtrim, v_image
      FROM vehicles v
      WHERE v.id = NEW.vehicle_id;

      v_found := FOUND;
    END IF;

    v_vehicle_title := COALESCE(
      NEW.vehicle_title,
      CASE
        WHEN v_found THEN trim(concat_ws(' ', v_vyear::text, v_vmake, v_vmodel, v_vtrim))
        ELSE NULL
      END,
      'Unknown vehicle'
    );

    v_title := 'Pre-order: ' || v_vehicle_title;
    v_message := v_name || ' · ' || v_vehicle_title || ' · $'
      || to_char(COALESCE(NEW.down_payment_usd, 0), 'FM999,999') || ' down';
    v_link := '/platform/leads/preorder/' || NEW.id::text;

    v_metadata := jsonb_build_object(
      'customer', jsonb_build_object(
        'name', NEW.name,
        'email', NEW.email,
        'phone', NEW.phone,
        'message', NEW.message
      ),
      'vehicle', jsonb_build_object(
        'id', COALESCE(NEW.vehicle_id::text, CASE WHEN v_found THEN v_vid::text ELSE NULL END),
        'year', CASE WHEN v_found THEN v_vyear ELSE NULL END,
        'make', CASE WHEN v_found THEN v_vmake ELSE NULL END,
        'model', CASE WHEN v_found THEN v_vmodel ELSE NULL END,
        'slug', COALESCE(NEW.vehicle_slug, CASE WHEN v_found THEN v_vslug ELSE NULL END),
        'price', COALESCE(NEW.vehicle_price_usd, CASE WHEN v_found THEN v_vprice ELSE NULL END),
        'image', v_image,
        'title', v_vehicle_title,
        'status', CASE WHEN v_found THEN v_vstatus ELSE NULL END
      ),
      'downPaymentUsd', NEW.down_payment_usd,
      'downPaymentFormatted', '$' || to_char(COALESCE(NEW.down_payment_usd, 0), 'FM999,999'),
      'paymentStatus', COALESCE(NEW.payment_status, 'pending')
    );

  ELSIF TG_TABLE_NAME = 'vehicle_inquiries' THEN
    v_name := NEW.name;
    v_title := 'New vehicle inquiry';
    v_message := v_name || ' inquired about ' || COALESCE(NEW.vehicle_name, NEW.vehicle_slug, 'a vehicle');
  ELSIF TG_TABLE_NAME = 'contact_inquiries' THEN
    v_name := NEW.name;
    v_title := 'New contact message';
    v_message := v_name || ': ' || LEFT(COALESCE(NEW.subject, NEW.message, ''), 80);
  ELSIF TG_TABLE_NAME = 'finance_applications' THEN
    v_name := NEW.first_name || ' ' || NEW.last_name;
    v_title := 'New finance application';
    v_message := TRIM(v_name) || ' applied for financing';
  ELSIF TG_TABLE_NAME = 'appraisal_requests' THEN
    v_name := NEW.seller_name;
    v_title := 'New appraisal request';
    v_message := v_name || ' wants to sell a ' || NEW.year || ' ' || NEW.make || ' ' || NEW.model;
  ELSE
    RETURN NEW;
  END IF;

  BEGIN
    INSERT INTO admin_notifications (type, title, message, link, source_table, source_id, metadata)
    VALUES (v_type, v_title, v_message, v_link, TG_TABLE_NAME, NEW.id, v_metadata);
  EXCEPTION
    WHEN unique_violation THEN
      NULL;
    WHEN undefined_column THEN
      INSERT INTO admin_notifications (type, title, message, link, source_table, source_id)
      VALUES (v_type, v_title, v_message, v_link, TG_TABLE_NAME, NEW.id);
  END;

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'notify_admin_inquiry failed for % id=%: %', TG_TABLE_NAME, NEW.id, SQLERRM;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_notify_preorder ON preorder_inquiries;
CREATE TRIGGER trg_notify_preorder
  AFTER INSERT ON preorder_inquiries
  FOR EACH ROW EXECUTE FUNCTION notify_admin_inquiry('preorder', '/platform/leads?tab=preorder');

-- ─── RLS: public insert + customer read ───────────────────────────────────────
ALTER TABLE preorder_inquiries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can submit preorder inquiries" ON preorder_inquiries;
CREATE POLICY "Anyone can submit preorder inquiries"
  ON preorder_inquiries FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Users can view own preorder inquiries" ON preorder_inquiries;
CREATE POLICY "Users can view own preorder inquiries"
  ON preorder_inquiries FOR SELECT
  USING (
    auth.uid() = user_id
    OR lower(email) = lower(COALESCE(auth.jwt() ->> 'email', ''))
  );


-- ─── 045_unified_cart_vehicles.sql ───
-- Extend customer cart to support vehicles alongside spare parts

ALTER TABLE cart_items
  ADD COLUMN IF NOT EXISTS item_type TEXT NOT NULL DEFAULT 'part',
  ADD COLUMN IF NOT EXISTS vehicle_id UUID REFERENCES vehicles(id) ON DELETE CASCADE;

ALTER TABLE cart_items
  DROP CONSTRAINT IF EXISTS cart_items_cart_id_part_id_key;

ALTER TABLE cart_items
  ALTER COLUMN part_id DROP NOT NULL;

ALTER TABLE cart_items
  DROP CONSTRAINT IF EXISTS cart_items_item_type_check;

ALTER TABLE cart_items
  ADD CONSTRAINT cart_items_item_type_check
  CHECK (item_type IN ('part', 'vehicle'));

ALTER TABLE cart_items
  DROP CONSTRAINT IF EXISTS cart_items_item_ref_check;

ALTER TABLE cart_items
  ADD CONSTRAINT cart_items_item_ref_check
  CHECK (
    (item_type = 'part' AND part_id IS NOT NULL AND vehicle_id IS NULL)
    OR (item_type = 'vehicle' AND vehicle_id IS NOT NULL AND part_id IS NULL)
  );

CREATE UNIQUE INDEX IF NOT EXISTS idx_cart_items_part_unique
  ON cart_items(cart_id, part_id)
  WHERE item_type = 'part' AND part_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_cart_items_vehicle_unique
  ON cart_items(cart_id, vehicle_id)
  WHERE item_type = 'vehicle' AND vehicle_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_cart_items_vehicle
  ON cart_items(vehicle_id)
  WHERE vehicle_id IS NOT NULL;


-- ─── 046_cart_history_purchases.sql ───
-- Unified order items (parts + vehicles) and expanded order statuses

ALTER TABLE parts_order_items
  ADD COLUMN IF NOT EXISTS item_type TEXT NOT NULL DEFAULT 'part',
  ADD COLUMN IF NOT EXISTS vehicle_id UUID REFERENCES vehicles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS item_intent TEXT;

ALTER TABLE parts_order_items
  ALTER COLUMN part_id DROP NOT NULL;

ALTER TABLE parts_order_items
  DROP CONSTRAINT IF EXISTS parts_order_items_item_type_check;

ALTER TABLE parts_order_items
  ADD CONSTRAINT parts_order_items_item_type_check
  CHECK (item_type IN ('part', 'vehicle'));

ALTER TABLE parts_order_items
  DROP CONSTRAINT IF EXISTS parts_order_items_item_ref_check;

ALTER TABLE parts_order_items
  ADD CONSTRAINT parts_order_items_item_ref_check
  CHECK (
    (item_type = 'part' AND part_id IS NOT NULL)
    OR (item_type = 'vehicle' AND vehicle_id IS NOT NULL)
  );

ALTER TABLE parts_order_items
  DROP CONSTRAINT IF EXISTS parts_order_items_item_intent_check;

ALTER TABLE parts_order_items
  ADD CONSTRAINT parts_order_items_item_intent_check
  CHECK (item_intent IS NULL OR item_intent IN ('buy', 'pre_order'));

CREATE INDEX IF NOT EXISTS idx_parts_order_items_vehicle
  ON parts_order_items(vehicle_id)
  WHERE vehicle_id IS NOT NULL;

ALTER TABLE parts_orders
  DROP CONSTRAINT IF EXISTS parts_orders_status_check;

ALTER TABLE parts_orders
  ADD CONSTRAINT parts_orders_status_check
  CHECK (status IN ('pending', 'confirmed', 'shipped', 'fulfilled', 'cancelled'));


-- ─── 047_checkout_appointments.sql ───
-- Post-checkout appointments + vehicle sale notifications

ALTER TABLE vehicle_appointments
  ADD COLUMN IF NOT EXISTS order_id UUID REFERENCES parts_orders(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS inquiry_id UUID REFERENCES preorder_inquiries(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'website',
  ADD COLUMN IF NOT EXISTS vehicle_ids JSONB NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE vehicle_appointments
  DROP CONSTRAINT IF EXISTS vehicle_appointments_source_check;

ALTER TABLE vehicle_appointments
  ADD CONSTRAINT vehicle_appointments_source_check
  CHECK (source IN ('website', 'checkout', 'preorder'));

CREATE INDEX IF NOT EXISTS idx_vehicle_appointments_order
  ON vehicle_appointments(order_id)
  WHERE order_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_vehicle_appointments_inquiry
  ON vehicle_appointments(inquiry_id)
  WHERE inquiry_id IS NOT NULL;

-- Notify admins when a customer requests a showroom appointment
CREATE OR REPLACE FUNCTION notify_vehicle_appointment()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_vehicle TEXT;
BEGIN
  SELECT trim(concat_ws(' ', year::text, make, model))
  INTO v_vehicle
  FROM vehicles
  WHERE id = NEW.vehicle_id;

  BEGIN
    INSERT INTO admin_notifications (type, title, message, link, source_table, source_id, metadata)
    VALUES (
      'appointment',
      'New appointment request',
      NEW.name || COALESCE(' · ' || v_vehicle, ''),
      '/platform/appointments',
      'vehicle_appointments',
      NEW.id,
      jsonb_build_object(
        'customer', jsonb_build_object('name', NEW.name, 'email', NEW.email, 'phone', NEW.phone),
        'preferred_date', NEW.preferred_date,
        'preferred_time', NEW.preferred_time,
        'branch', NEW.branch,
        'source', NEW.source
      )
    );
  EXCEPTION
    WHEN unique_violation THEN
      NULL;
    WHEN undefined_column THEN
      INSERT INTO admin_notifications (type, title, message, link, source_table, source_id)
      VALUES (
        'appointment',
        'New appointment request',
        NEW.name || COALESCE(' · ' || v_vehicle, ''),
        '/platform/appointments',
        'vehicle_appointments',
        NEW.id
      );
  END;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_vehicle_appointment ON vehicle_appointments;
CREATE TRIGGER trg_notify_vehicle_appointment
  AFTER INSERT ON vehicle_appointments
  FOR EACH ROW EXECUTE FUNCTION notify_vehicle_appointment();

-- Richer notification when a cart order includes vehicles (buy / pre-order intent)
CREATE OR REPLACE FUNCTION notify_parts_order()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_vehicle_count INTEGER;
  v_vehicle_lines TEXT;
  v_title TEXT;
  v_message TEXT;
  v_link TEXT;
BEGIN
  SELECT COUNT(*)::INTEGER,
         string_agg(
           part_name || CASE WHEN item_intent = 'pre_order' THEN ' (pre-order)' ELSE ' (buy)' END,
           ', '
         )
  INTO v_vehicle_count, v_vehicle_lines
  FROM parts_order_items
  WHERE order_id = NEW.id AND item_type = 'vehicle';

  IF v_vehicle_count > 0 THEN
    v_title := CASE WHEN v_vehicle_count = 1 THEN 'Vehicle purchase request' ELSE 'Vehicle cart order' END;
    v_message := NEW.name || ' — ' || COALESCE(v_vehicle_lines, v_vehicle_count::text || ' vehicle(s)')
      || ' · order ' || LEFT(NEW.id::text, 8);
    v_link := '/platform/leads/order/' || NEW.id::text;
  ELSE
    v_title := 'New parts order';
    v_message := NEW.name || ' — total ' || NEW.total_usd::text;
    v_link := '/platform/leads/order/' || NEW.id::text;
  END IF;

  BEGIN
    INSERT INTO admin_notifications (type, title, message, link, source_table, source_id, metadata)
    VALUES (
      CASE WHEN v_vehicle_count > 0 THEN 'vehicle_order' ELSE 'inquiry' END,
      v_title,
      v_message,
      v_link,
      'parts_orders',
      NEW.id,
      jsonb_build_object(
        'customer', jsonb_build_object('name', NEW.name, 'email', NEW.email, 'phone', NEW.phone),
        'total_usd', NEW.total_usd,
        'vehicle_count', v_vehicle_count
      )
    );
  EXCEPTION
    WHEN unique_violation THEN
      NULL;
    WHEN undefined_column THEN
      INSERT INTO admin_notifications (type, title, message, link, source_table, source_id)
      VALUES (
        CASE WHEN v_vehicle_count > 0 THEN 'vehicle_order' ELSE 'inquiry' END,
        v_title,
        v_message,
        v_link,
        'parts_orders',
        NEW.id
      );
  END;

  RETURN NEW;
END;
$$;


-- ─── 048_email_history_indexes.sql ───
-- Speed up platform email history queries (channel = email).

CREATE INDEX IF NOT EXISTS idx_notification_log_email_created
  ON notification_log(created_at DESC)
  WHERE channel = 'email';

CREATE INDEX IF NOT EXISTS idx_notification_log_email_status
  ON notification_log(status, created_at DESC)
  WHERE channel = 'email';


-- ─── 049_cart_customer_messaging.sql ───
-- Link customer conversations to cart orders for staff messaging context

ALTER TABLE customer_conversations
  ADD COLUMN IF NOT EXISTS parts_order_id UUID REFERENCES parts_orders(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_customer_conversations_parts_order
  ON customer_conversations(parts_order_id)
  WHERE parts_order_id IS NOT NULL;


-- ─── 049_performance_indexes.sql ───
-- Speed up public inventory, dashboard stats, and cart lookups.

CREATE INDEX IF NOT EXISTS idx_vehicles_status_created
  ON vehicles(status, created_at DESC)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_vehicles_slug
  ON vehicles(slug)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_vehicles_approval_status
  ON vehicles(approval_status)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_preorder_inquiries_status_created
  ON preorder_inquiries(status, created_at DESC)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_preorder_inquiries_payment_status
  ON preorder_inquiries(payment_status)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_admin_notifications_unread
  ON admin_notifications(created_at DESC)
  WHERE read_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_vehicle_inquiries_status
  ON vehicle_inquiries(status, created_at DESC)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_contact_inquiries_status
  ON contact_inquiries(status, created_at DESC)
  WHERE deleted_at IS NULL;


-- ─── 050_parts_order_confirmed_at.sql ───
-- Track when staff confirms a cart order

ALTER TABLE parts_orders
  ADD COLUMN IF NOT EXISTS confirmed_at TIMESTAMPTZ;


-- ─── 051_custom_preorder_requests.sql ───
-- Custom vehicle pre-order requests (cars not in catalog)

ALTER TABLE preorder_inquiries
  ADD COLUMN IF NOT EXISTS is_custom_request BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS requested_make TEXT,
  ADD COLUMN IF NOT EXISTS requested_model TEXT,
  ADD COLUMN IF NOT EXISTS requested_year TEXT,
  ADD COLUMN IF NOT EXISTS requested_specs JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS budget_min INTEGER,
  ADD COLUMN IF NOT EXISTS budget_max INTEGER,
  ADD COLUMN IF NOT EXISTS reference_code TEXT,
  ADD COLUMN IF NOT EXISTS matched_vehicle_id UUID REFERENCES vehicles(id) ON DELETE SET NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_preorder_inquiries_reference_code
  ON preorder_inquiries(reference_code)
  WHERE reference_code IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_preorder_inquiries_custom
  ON preorder_inquiries(is_custom_request, created_at DESC)
  WHERE is_custom_request = true;

CREATE OR REPLACE FUNCTION public.generate_custom_request_reference_code()
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
  date_part TEXT := to_char(NOW(), 'YYYYMMDD');
  suffix TEXT;
  candidate TEXT;
  attempts INTEGER := 0;
BEGIN
  LOOP
    suffix := upper(substr(md5(random()::text || clock_timestamp()::text), 1, 4));
    candidate := 'CR-' || date_part || '-' || suffix;
    IF NOT EXISTS (
      SELECT 1 FROM preorder_inquiries WHERE reference_code = candidate
    ) THEN
      RETURN candidate;
    END IF;
    attempts := attempts + 1;
    IF attempts > 20 THEN
      RAISE EXCEPTION 'Could not generate unique custom request reference code';
    END IF;
  END LOOP;
END;
$$;

-- Notify admins with custom-request-specific title when applicable
CREATE OR REPLACE FUNCTION public.notify_admin_inquiry()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_type TEXT;
  v_link TEXT;
  v_title TEXT;
  v_message TEXT;
  v_name TEXT;
  v_metadata JSONB := '{}'::jsonb;
  v_vehicle_title TEXT;
  v_image TEXT;
  v_vid UUID;
  v_vyear INT;
  v_vmake TEXT;
  v_vmodel TEXT;
  v_vslug TEXT;
  v_vprice INT;
  v_vstatus TEXT;
  v_vtrim TEXT;
  v_found BOOLEAN := false;
  v_specs JSONB;
  v_budget TEXT;
BEGIN
  v_type := TG_ARGV[0];
  v_link := TG_ARGV[1];

  IF TG_TABLE_NAME = 'preorder_inquiries' THEN
    v_name := NEW.name;

    IF COALESCE(NEW.is_custom_request, false) THEN
      v_vehicle_title := trim(concat_ws(' ',
        NULLIF(NEW.requested_year, ''),
        NULLIF(NEW.requested_make, ''),
        NULLIF(NEW.requested_model, '')
      ));
      IF v_vehicle_title = '' THEN
        v_vehicle_title := 'Custom vehicle request';
      END IF;

      v_specs := COALESCE(NEW.requested_specs, '{}'::jsonb);
      v_budget := CASE
        WHEN NEW.budget_min IS NOT NULL AND NEW.budget_max IS NOT NULL THEN
          'GHS ' || to_char(NEW.budget_min, 'FM999,999') || ' – GHS ' || to_char(NEW.budget_max, 'FM999,999')
        WHEN NEW.budget_max IS NOT NULL THEN
          'Up to GHS ' || to_char(NEW.budget_max, 'FM999,999')
        WHEN NEW.budget_min IS NOT NULL THEN
          'From GHS ' || to_char(NEW.budget_min, 'FM999,999')
        ELSE 'Budget not specified'
      END;

      v_title := 'Custom vehicle request: ' || v_vehicle_title;
      v_message := v_name || ' · ' || v_vehicle_title || ' · ' || v_budget
        || COALESCE(' · Ref ' || NEW.reference_code, '');
      v_link := '/platform/leads/preorder/' || NEW.id::text;

      v_metadata := jsonb_build_object(
        'isCustomRequest', true,
        'referenceCode', NEW.reference_code,
        'customer', jsonb_build_object(
          'name', NEW.name,
          'email', NEW.email,
          'phone', NEW.phone,
          'message', NEW.message
        ),
        'requested', jsonb_build_object(
          'make', NEW.requested_make,
          'model', NEW.requested_model,
          'year', NEW.requested_year,
          'specs', v_specs,
          'budgetMinGhs', NEW.budget_min,
          'budgetMaxGhs', NEW.budget_max
        ),
        'paymentStatus', COALESCE(NEW.payment_status, 'pending')
      );

    ELSE
      IF NEW.vehicle_id IS NOT NULL THEN
        SELECT
          v.id, v.year, v.make, v.model, v.slug, v.price, v.status, v.trim,
          CASE
            WHEN v.images IS NOT NULL AND array_length(v.images, 1) > 0 THEN v.images[1]
            ELSE NULL
          END
        INTO
          v_vid, v_vyear, v_vmake, v_vmodel, v_vslug, v_vprice, v_vstatus, v_vtrim, v_image
        FROM vehicles v
        WHERE v.id = NEW.vehicle_id;

        v_found := FOUND;
      END IF;

      v_vehicle_title := COALESCE(
        NEW.vehicle_title,
        CASE
          WHEN v_found THEN trim(concat_ws(' ', v_vyear::text, v_vmake, v_vmodel, v_vtrim))
          ELSE NULL
        END,
        'Unknown vehicle'
      );

      v_title := 'Pre-order: ' || v_vehicle_title;
      v_message := v_name || ' · ' || v_vehicle_title || ' · $'
        || to_char(COALESCE(NEW.down_payment_usd, 0), 'FM999,999') || ' down';
      v_link := '/platform/leads/preorder/' || NEW.id::text;

      v_metadata := jsonb_build_object(
        'customer', jsonb_build_object(
          'name', NEW.name,
          'email', NEW.email,
          'phone', NEW.phone,
          'message', NEW.message
        ),
        'vehicle', jsonb_build_object(
          'id', COALESCE(NEW.vehicle_id::text, CASE WHEN v_found THEN v_vid::text ELSE NULL END),
          'year', CASE WHEN v_found THEN v_vyear ELSE NULL END,
          'make', CASE WHEN v_found THEN v_vmake ELSE NULL END,
          'model', CASE WHEN v_found THEN v_vmodel ELSE NULL END,
          'slug', COALESCE(NEW.vehicle_slug, CASE WHEN v_found THEN v_vslug ELSE NULL END),
          'price', COALESCE(NEW.vehicle_price_usd, CASE WHEN v_found THEN v_vprice ELSE NULL END),
          'image', v_image,
          'title', v_vehicle_title,
          'status', CASE WHEN v_found THEN v_vstatus ELSE NULL END
        ),
        'downPaymentUsd', NEW.down_payment_usd,
        'downPaymentFormatted', '$' || to_char(COALESCE(NEW.down_payment_usd, 0), 'FM999,999'),
        'paymentStatus', COALESCE(NEW.payment_status, 'pending')
      );
    END IF;

  ELSIF TG_TABLE_NAME = 'vehicle_inquiries' THEN
    v_name := NEW.name;
    v_title := 'New vehicle inquiry';
    v_message := v_name || ' inquired about ' || COALESCE(NEW.vehicle_name, NEW.vehicle_slug, 'a vehicle');
  ELSIF TG_TABLE_NAME = 'contact_inquiries' THEN
    v_name := NEW.name;
    v_title := 'New contact message';
    v_message := v_name || ': ' || LEFT(COALESCE(NEW.subject, NEW.message, ''), 80);
  ELSIF TG_TABLE_NAME = 'finance_applications' THEN
    v_name := NEW.first_name || ' ' || NEW.last_name;
    v_title := 'New finance application';
    v_message := TRIM(v_name) || ' applied for financing';
  ELSIF TG_TABLE_NAME = 'appraisal_requests' THEN
    v_name := NEW.seller_name;
    v_title := 'New appraisal request';
    v_message := v_name || ' wants to sell a ' || NEW.year || ' ' || NEW.make || ' ' || NEW.model;
  ELSE
    RETURN NEW;
  END IF;

  BEGIN
    INSERT INTO admin_notifications (type, title, message, link, source_table, source_id, metadata)
    VALUES (v_type, v_title, v_message, v_link, TG_TABLE_NAME, NEW.id, v_metadata);
  EXCEPTION
    WHEN unique_violation THEN
      NULL;
    WHEN undefined_column THEN
      INSERT INTO admin_notifications (type, title, message, link, source_table, source_id)
      VALUES (v_type, v_title, v_message, v_link, TG_TABLE_NAME, NEW.id);
  END;

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'notify_admin_inquiry failed for % id=%: %', TG_TABLE_NAME, NEW.id, SQLERRM;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_preorder ON preorder_inquiries;
CREATE TRIGGER trg_notify_preorder
  AFTER INSERT ON preorder_inquiries
  FOR EACH ROW EXECUTE FUNCTION notify_admin_inquiry('preorder', '/platform/leads?tab=preorder');


-- ─── 052_customer_soft_delete.sql ───
-- Soft-delete customers: hide from active list while preserving order history.

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_profiles_deleted_at ON profiles (deleted_at)
  WHERE deleted_at IS NOT NULL;

-- Track deleted contact-only customers (no profile row).
CREATE TABLE IF NOT EXISTS deleted_customer_emails (
  email TEXT PRIMARY KEY,
  deleted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_by TEXT
);

CREATE INDEX IF NOT EXISTS idx_deleted_customer_emails_deleted_at
  ON deleted_customer_emails (deleted_at DESC);


-- ─── 053_rejected_edit_reapproval.sql ───
-- Rejected edit proposals keep pending_changes so owners can re-approve.
-- Live approved rows with rejected edits must stay visible on the public site.

DROP POLICY IF EXISTS "Vehicles are publicly readable" ON vehicles;
CREATE POLICY "Vehicles are publicly readable"
  ON vehicles FOR SELECT
  USING (
    status IN ('available', 'pre_order')
    AND (
      approval_status = 'approved'
      OR (
        approval_status IN ('pending_approval', 'rejected')
        AND pending_changes IS NOT NULL
      )
    )
  );


-- ─── 054_platform_trash.sql ───
-- Unified platform recycle bin: audit trail + soft-delete columns on key entities.

CREATE TABLE IF NOT EXISTS platform_trash (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  entity_label TEXT NOT NULL,
  snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
  deleted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_by_user_id UUID REFERENCES platform_users(id) ON DELETE SET NULL,
  deleted_by_name TEXT,
  deleted_by_email TEXT,
  restored_at TIMESTAMPTZ,
  permanently_deleted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_platform_trash_active
  ON platform_trash (deleted_at DESC)
  WHERE restored_at IS NULL AND permanently_deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_platform_trash_entity_type
  ON platform_trash (entity_type)
  WHERE restored_at IS NULL AND permanently_deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_platform_trash_deleted_by
  ON platform_trash (deleted_by_user_id)
  WHERE restored_at IS NULL AND permanently_deleted_at IS NULL;

-- Soft-delete columns (nullable = active record)
ALTER TABLE vehicles
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS deleted_by_user_id UUID REFERENCES platform_users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_vehicles_deleted_at ON vehicles (deleted_at)
  WHERE deleted_at IS NOT NULL;

ALTER TABLE expenses
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS deleted_by_user_id UUID REFERENCES platform_users(id) ON DELETE SET NULL;

ALTER TABLE sales
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS deleted_by_user_id UUID REFERENCES platform_users(id) ON DELETE SET NULL;

ALTER TABLE parts_orders
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS deleted_by_user_id UUID REFERENCES platform_users(id) ON DELETE SET NULL;

ALTER TABLE preorder_inquiries
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS deleted_by_user_id UUID REFERENCES platform_users(id) ON DELETE SET NULL;

ALTER TABLE contact_inquiries
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS deleted_by_user_id UUID REFERENCES platform_users(id) ON DELETE SET NULL;

ALTER TABLE finance_applications
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS deleted_by_user_id UUID REFERENCES platform_users(id) ON DELETE SET NULL;

ALTER TABLE appraisal_requests
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS deleted_by_user_id UUID REFERENCES platform_users(id) ON DELETE SET NULL;

ALTER TABLE vehicle_inquiries
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS deleted_by_user_id UUID REFERENCES platform_users(id) ON DELETE SET NULL;

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS deleted_by_user_id UUID REFERENCES platform_users(id) ON DELETE SET NULL;

ALTER TABLE platform_trash ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role manages platform trash" ON platform_trash;
CREATE POLICY "Service role manages platform trash"
  ON platform_trash FOR ALL USING (false) WITH CHECK (false);


-- ─── 055_dashboard_transaction_dismissals.sql ───
-- Hide sold/reserved/pre-order rows from the dashboard "Recent transactions" widget
-- without soft-deleting the vehicle from inventory.

CREATE TABLE IF NOT EXISTS dashboard_transaction_dismissals (
  vehicle_id UUID PRIMARY KEY REFERENCES vehicles(id) ON DELETE CASCADE,
  dismissed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  dismissed_by_user_id UUID REFERENCES platform_users(id) ON DELETE SET NULL,
  dismissed_by_name TEXT,
  dismissed_by_email TEXT
);

CREATE INDEX IF NOT EXISTS idx_dashboard_transaction_dismissals_dismissed_at
  ON dashboard_transaction_dismissals (dismissed_at DESC);

ALTER TABLE dashboard_transaction_dismissals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role manages dashboard dismissals" ON dashboard_transaction_dismissals;
CREATE POLICY "Service role manages dashboard dismissals"
  ON dashboard_transaction_dismissals FOR ALL USING (false) WITH CHECK (false);


-- ─── 056_session_preference.sql ───
-- Optional profile field for customer sign-in persistence preference
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS session_preference TEXT;

COMMENT ON COLUMN profiles.session_preference IS
  'Customer sign-in preference: stay_signed_in, ask_each_time, or no_save';


-- ─── 057_customer_notifications.sql ───
-- In-app customer notifications (badge on My Account, account page inbox)

CREATE TABLE IF NOT EXISTS customer_notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  link TEXT,
  source_table TEXT,
  source_id TEXT,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  metadata JSONB DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_customer_notifications_user_unread
  ON customer_notifications(user_id, created_at DESC)
  WHERE read_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_customer_notifications_user_created
  ON customer_notifications(user_id, created_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS idx_customer_notifications_dedupe
  ON customer_notifications(user_id, type, source_table, source_id)
  WHERE source_id IS NOT NULL AND source_table IS NOT NULL;

ALTER TABLE customer_notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "No public access to customer notifications" ON customer_notifications;
CREATE POLICY "No public access to customer notifications"
  ON customer_notifications FOR ALL USING (false) WITH CHECK (false);


-- ─── 058_termii_notification_settings.sql ───
-- Termii notification settings defaults and SMS channel in notification_log.

INSERT INTO site_settings (key, value) VALUES
  ('termii_api_key', ''),
  ('termii_sender_id', ''),
  ('termii_whatsapp_device', ''),
  ('termii_base_url', 'https://api.ng.termii.com'),
  ('termii_sms_channel', 'dnd')
ON CONFLICT (key) DO NOTHING;

-- Allow SMS channel in delivery log (Termii fallback).
ALTER TABLE notification_log DROP CONSTRAINT IF EXISTS notification_log_channel_check;
ALTER TABLE notification_log ADD CONSTRAINT notification_log_channel_check
  CHECK (channel IN ('whatsapp', 'email', 'sms'));


-- ─── 059_google_oauth_profile_names.sql ───
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


-- ─── 060_vehicle_gallery_images.sql ───
-- Primary listing image + unlimited additional gallery images per vehicle.
-- Keeps existing gallery JSONB in sync for backward compatibility.

ALTER TABLE vehicles
  ADD COLUMN IF NOT EXISTS gallery JSONB
  DEFAULT '{"exterior":[],"interior":[],"engine":[],"other":[]}'::jsonb;

ALTER TABLE vehicles
  ADD COLUMN IF NOT EXISTS primary_image_url TEXT;

ALTER TABLE vehicles
  ADD COLUMN IF NOT EXISTS additional_images TEXT[] DEFAULT '{}';

-- Backfill primary from first exterior gallery shot or legacy images[].
UPDATE vehicles
SET primary_image_url = COALESCE(
  NULLIF(TRIM(gallery->'exterior'->>0), ''),
  images[1]
)
WHERE primary_image_url IS NULL
  AND (
    (gallery->'exterior'->>0) IS NOT NULL
    OR (images IS NOT NULL AND array_length(images, 1) > 0)
  );

-- Backfill additional from legacy images[] tail when column is empty.
UPDATE vehicles
SET additional_images = images[2:array_length(images, 1)]
WHERE (additional_images IS NULL OR cardinality(additional_images) = 0)
  AND images IS NOT NULL
  AND array_length(images, 1) > 1;

-- Backfill additional from categorized gallery (everything after primary).
UPDATE vehicles v
SET additional_images = sub.urls
FROM (
  SELECT
    id,
    ARRAY(
      SELECT DISTINCT url
      FROM (
        SELECT jsonb_array_elements_text(COALESCE(gallery->'exterior', '[]'::jsonb)) AS url
        UNION ALL
        SELECT jsonb_array_elements_text(COALESCE(gallery->'interior', '[]'::jsonb))
        UNION ALL
        SELECT jsonb_array_elements_text(COALESCE(gallery->'engine', '[]'::jsonb))
        UNION ALL
        SELECT jsonb_array_elements_text(COALESCE(gallery->'other', '[]'::jsonb))
      ) AS all_urls
      WHERE url IS NOT NULL
        AND TRIM(url) <> ''
        AND url <> COALESCE(primary_image_url, '')
    ) AS urls
  FROM vehicles
  WHERE gallery IS NOT NULL
    AND gallery <> '{"exterior":[],"interior":[],"engine":[],"other":[]}'::jsonb
) sub
WHERE v.id = sub.id
  AND (v.additional_images IS NULL OR cardinality(v.additional_images) = 0)
  AND cardinality(sub.urls) > 0;


-- ─── 061_vehicle_preferences.sql ───
-- Customer vehicle preference profile for cross-device recommendations
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS vehicle_preferences JSONB;

COMMENT ON COLUMN profiles.vehicle_preferences IS
  'Weighted vehicle engagement profile (make, body type, fuel, price band, origin) for personalized suggestions';


-- ─── 062_vehicle_trust_and_filters.sql ───
-- Vehicle trust badges, inspection summary, and professional filter fields

ALTER TABLE vehicles
  ADD COLUMN IF NOT EXISTS trust_badges JSONB NOT NULL DEFAULT '{
    "verified_by_true_goshen": true,
    "genuine_listing": true
  }'::jsonb,
  ADD COLUMN IF NOT EXISTS inspection_summary TEXT,
  ADD COLUMN IF NOT EXISTS country_of_origin TEXT,
  ADD COLUMN IF NOT EXISTS financing_available BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS shipment_available BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS customs_clearing_available BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE vehicles
  DROP CONSTRAINT IF EXISTS vehicles_country_of_origin_check;

ALTER TABLE vehicles
  ADD CONSTRAINT vehicles_country_of_origin_check
  CHECK (country_of_origin IS NULL OR country_of_origin IN ('china', 'japan', 'ghana', 'other'));

COMMENT ON COLUMN vehicles.trust_badges IS
  'Trust indicators: verified_by_true_goshen, professionally_inspected, documentation_verified, mileage_verified, import_status_verified, genuine_listing';


-- ─── 063_shipment_timeline_enhancements.sql ───
-- Extended shipment milestone metadata for customer tracking

ALTER TABLE shipment_timeline_events
  ADD COLUMN IF NOT EXISTS estimated_completion TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS admin_comment TEXT,
  ADD COLUMN IF NOT EXISTS attachment_urls TEXT[] NOT NULL DEFAULT '{}';

COMMENT ON COLUMN shipment_timeline_events.admin_comment IS
  'Internal or customer-facing note from admin when updating this milestone';


-- ─── 064_vehicle_warranty_notes.sql ───
-- Optional per-vehicle warranty notes for detail page display

ALTER TABLE vehicles
  ADD COLUMN IF NOT EXISTS warranty_notes TEXT;

COMMENT ON COLUMN vehicles.warranty_notes IS
  'Optional warranty coverage notes shown on the vehicle detail page; sensible defaults apply when null';


-- ─── 065_vehicle_walkaround_video.sql ───
-- Optional walkaround video URL for vehicle detail page

ALTER TABLE vehicles
  ADD COLUMN IF NOT EXISTS walkaround_video_url TEXT;

COMMENT ON COLUMN vehicles.walkaround_video_url IS
  'Optional YouTube, Vimeo, or direct MP4 URL shown as walkaround video on vehicle detail';


-- ─── 066_price_alerts.sql ───
-- Price drop alerts for vehicle detail page

CREATE TABLE IF NOT EXISTS price_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id TEXT NOT NULL,
  vehicle_slug TEXT,
  vehicle_name TEXT,
  price_usd_at_signup NUMERIC NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_price_alerts_vehicle_id ON price_alerts(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_price_alerts_email ON price_alerts(email);
CREATE INDEX IF NOT EXISTS idx_price_alerts_status ON price_alerts(status);

COMMENT ON TABLE price_alerts IS
  'Customer price-drop notifications — signed up from vehicle detail page';


-- ─── 067_vehicle_interest_local_availability.sql ───
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


-- ─── 068_customer_self_delete.sql ───
-- Hard-delete all customer account data (GDPR-style self-service deletion).
-- Called from the customer delete-account API before auth.users removal.

CREATE OR REPLACE FUNCTION public.delete_customer_account_data(p_user_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_email_lower TEXT;
BEGIN
  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'User id is required';
  END IF;

  SELECT lower(trim(email))
  INTO v_email_lower
  FROM profiles
  WHERE id = p_user_id;

  IF v_email_lower IS NULL OR v_email_lower = '' THEN
    SELECT lower(trim(email))
    INTO v_email_lower
    FROM auth.users
    WHERE id = p_user_id;
  END IF;

  IF v_email_lower IS NULL OR v_email_lower = '' THEN
    RAISE EXCEPTION 'Customer profile not found';
  END IF;

  -- Conversations and messaging
  DELETE FROM customer_conversation_messages
  WHERE conversation_id IN (
    SELECT id FROM customer_conversations WHERE user_id = p_user_id
  );

  DELETE FROM customer_conversations WHERE user_id = p_user_id;
  DELETE FROM customer_messages WHERE user_id = p_user_id;

  -- Cart
  DELETE FROM cart_items
  WHERE cart_id IN (SELECT id FROM customer_carts WHERE user_id = p_user_id);

  DELETE FROM customer_carts WHERE user_id = p_user_id;

  -- Notifications and saved vehicles
  DELETE FROM customer_notifications WHERE user_id = p_user_id;
  DELETE FROM saved_vehicles WHERE user_id = p_user_id;

  -- Vehicle engagement
  DELETE FROM vehicle_availability_notifications
  WHERE lower(trim(email)) = v_email_lower;

  DELETE FROM vehicle_interest
  WHERE user_id = p_user_id
     OR lower(trim(coalesce(email, ''))) = v_email_lower;

  DELETE FROM price_alerts
  WHERE user_id = p_user_id
     OR lower(trim(email)) = v_email_lower;

  -- Appointments (before orders/inquiries they may reference)
  DELETE FROM vehicle_appointments
  WHERE user_id = p_user_id
     OR lower(trim(email)) = v_email_lower;

  -- Orders
  DELETE FROM parts_order_items
  WHERE order_id IN (
    SELECT id FROM parts_orders
    WHERE user_id = p_user_id
       OR lower(trim(email)) = v_email_lower
  );

  DELETE FROM parts_orders
  WHERE user_id = p_user_id
     OR lower(trim(email)) = v_email_lower;

  -- Shipments
  DELETE FROM shipment_timeline_events
  WHERE shipment_id IN (
    SELECT id FROM shipment_tracking
    WHERE user_id = p_user_id
       OR lower(trim(coalesce(customer_email, ''))) = v_email_lower
  );

  DELETE FROM shipment_tracking
  WHERE user_id = p_user_id
     OR lower(trim(coalesce(customer_email, ''))) = v_email_lower;

  -- Inquiries and quotes
  DELETE FROM freight_quote_requests
  WHERE user_id = p_user_id
     OR lower(trim(email)) = v_email_lower;

  DELETE FROM preorder_inquiries
  WHERE user_id = p_user_id
     OR lower(trim(email)) = v_email_lower;

  DELETE FROM finance_applications
  WHERE user_id = p_user_id
     OR lower(trim(email)) = v_email_lower;

  DELETE FROM contact_inquiries
  WHERE lower(trim(email)) = v_email_lower;

  DELETE FROM vehicle_inquiries
  WHERE lower(trim(email)) = v_email_lower;

  DELETE FROM newsletter_subscribers
  WHERE lower(trim(email)) = v_email_lower;

  -- Soft-delete tracking and admin trash snapshots
  DELETE FROM deleted_customer_emails
  WHERE lower(trim(email)) = v_email_lower;

  DELETE FROM platform_trash
  WHERE entity_type = 'customer'
    AND (
      entity_id = p_user_id::text
      OR entity_id = 'email:' || v_email_lower
    );

  DELETE FROM profiles WHERE id = p_user_id;
END;
$$;

REVOKE ALL ON FUNCTION public.delete_customer_account_data(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.delete_customer_account_data(UUID) TO service_role;

COMMENT ON FUNCTION public.delete_customer_account_data(UUID) IS
  'Removes all public-schema customer data for self-service account deletion.';


-- ─── 069_inventory_filter_defaults.sql ───
-- Inventory filter defaults, constraints, and query indexes
-- Backfill note: existing rows keep current values; new defaults apply to INSERT only.
-- After deploy, run optional backfill to align contradictory rows:
--   UPDATE vehicles SET shipment_available = false WHERE available_locally = true;

ALTER TABLE vehicles
  ALTER COLUMN financing_available SET DEFAULT false,
  ALTER COLUMN shipment_available SET DEFAULT false,
  ALTER COLUMN customs_clearing_available SET DEFAULT false;

ALTER TABLE vehicles
  DROP CONSTRAINT IF EXISTS vehicles_local_shipment_exclusive;

ALTER TABLE vehicles
  ADD CONSTRAINT vehicles_local_shipment_exclusive
  CHECK (NOT (available_locally = true AND shipment_available = true));

CREATE INDEX IF NOT EXISTS idx_vehicles_filter_make_model
  ON vehicles (make, model);

CREATE INDEX IF NOT EXISTS idx_vehicles_filter_price_year
  ON vehicles (price, year);

CREATE INDEX IF NOT EXISTS idx_vehicles_filter_body_fuel
  ON vehicles (body_type, fuel_type);

CREATE INDEX IF NOT EXISTS idx_vehicles_filter_status_local
  ON vehicles (status, available_locally);

CREATE INDEX IF NOT EXISTS idx_vehicles_filter_origin
  ON vehicles (country_of_origin);

CREATE INDEX IF NOT EXISTS idx_vehicles_trust_badges_gin
  ON vehicles USING GIN (trust_badges);

COMMENT ON CONSTRAINT vehicles_local_shipment_exclusive ON vehicles IS
  'Locally available stock cannot also be marked as shipment/import inventory.';


-- ─── 070_account_deletion_lifecycle.sql ───
-- Enterprise account deletion lifecycle (soft delete + retention + anonymization).
-- Extends migration 068 hard-delete with a recoverable pending-deletion flow.

-- ---------------------------------------------------------------------------
-- Schema: profile lifecycle columns
-- ---------------------------------------------------------------------------

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS account_status TEXT NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS deletion_requested_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS scheduled_deletion_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS retention_expires_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS anonymized_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS is_anonymized BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS deletion_feedback JSONB,
  ADD COLUMN IF NOT EXISTS deletion_reason TEXT;

ALTER TABLE profiles
  DROP CONSTRAINT IF EXISTS profiles_account_status_check;

ALTER TABLE profiles
  ADD CONSTRAINT profiles_account_status_check
  CHECK (
    account_status IN (
      'active',
      'suspended',
      'pending_deletion',
      'archived',
      'deleted'
    )
  );

CREATE INDEX IF NOT EXISTS idx_profiles_account_status
  ON profiles (account_status);

CREATE INDEX IF NOT EXISTS idx_profiles_pending_deletion
  ON profiles (retention_expires_at)
  WHERE account_status = 'pending_deletion';

COMMENT ON COLUMN profiles.account_status IS
  'Customer account lifecycle: active, suspended, pending_deletion, archived, deleted.';

-- ---------------------------------------------------------------------------
-- Audit log
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS account_lifecycle_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  action TEXT NOT NULL,
  user_id UUID,
  administrator_id UUID REFERENCES platform_users(id) ON DELETE SET NULL,
  ip_address INET,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_account_lifecycle_audit_user
  ON account_lifecycle_audit_log (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_account_lifecycle_audit_action
  ON account_lifecycle_audit_log (action, created_at DESC);

ALTER TABLE account_lifecycle_audit_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role manages account lifecycle audit" ON account_lifecycle_audit_log;
CREATE POLICY "Service role manages account lifecycle audit"
  ON account_lifecycle_audit_log FOR ALL USING (false) WITH CHECK (false);

-- ---------------------------------------------------------------------------
-- Rate limiting for deletion requests
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS account_deletion_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  attempted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ip_address TEXT,
  success BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE INDEX IF NOT EXISTS idx_account_deletion_attempts_user
  ON account_deletion_attempts (user_id, attempted_at DESC);

ALTER TABLE account_deletion_attempts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role manages deletion attempts" ON account_deletion_attempts;
CREATE POLICY "Service role manages deletion attempts"
  ON account_deletion_attempts FOR ALL USING (false) WITH CHECK (false);

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.anonymized_customer_ref(p_user_id UUID)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT 'deleted_user_' || replace(p_user_id::text, '-', '');
$$;

CREATE OR REPLACE FUNCTION public.anonymized_customer_email(p_user_id UUID)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT anonymized_customer_ref(p_user_id) || '@deleted.nabus.local';
$$;

CREATE OR REPLACE FUNCTION public.log_account_lifecycle_event(
  p_action TEXT,
  p_user_id UUID,
  p_administrator_id UUID DEFAULT NULL,
  p_ip_address INET DEFAULT NULL,
  p_metadata JSONB DEFAULT '{}'::jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO account_lifecycle_audit_log (
    action,
    user_id,
    administrator_id,
    ip_address,
    metadata
  ) VALUES (
    p_action,
    p_user_id,
    p_administrator_id,
    p_ip_address,
    COALESCE(p_metadata, '{}'::jsonb)
  );
END;
$$;

-- ---------------------------------------------------------------------------
-- Immediate personal data purge (on deletion request)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.purge_customer_personal_data(p_user_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_email_lower TEXT;
BEGIN
  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'User id is required';
  END IF;

  SELECT lower(trim(email))
  INTO v_email_lower
  FROM profiles
  WHERE id = p_user_id;

  IF v_email_lower IS NULL OR v_email_lower = '' THEN
    SELECT lower(trim(email))
    INTO v_email_lower
    FROM auth.users
    WHERE id = p_user_id;
  END IF;

  -- Messaging
  DELETE FROM customer_conversation_messages
  WHERE conversation_id IN (
    SELECT id FROM customer_conversations WHERE user_id = p_user_id
  );
  DELETE FROM customer_conversations WHERE user_id = p_user_id;
  DELETE FROM customer_messages WHERE user_id = p_user_id;

  -- Cart
  DELETE FROM cart_items
  WHERE cart_id IN (SELECT id FROM customer_carts WHERE user_id = p_user_id);
  DELETE FROM customer_carts WHERE user_id = p_user_id;

  -- Notifications, saved vehicles, alerts
  DELETE FROM customer_notifications WHERE user_id = p_user_id;
  DELETE FROM saved_vehicles WHERE user_id = p_user_id;

  IF v_email_lower IS NOT NULL AND v_email_lower <> '' THEN
    DELETE FROM vehicle_availability_notifications
    WHERE lower(trim(email)) = v_email_lower;

    DELETE FROM vehicle_interest
    WHERE user_id = p_user_id
       OR lower(trim(coalesce(email, ''))) = v_email_lower;

    DELETE FROM price_alerts
    WHERE user_id = p_user_id
       OR lower(trim(email)) = v_email_lower;

    DELETE FROM newsletter_subscribers
    WHERE lower(trim(email)) = v_email_lower;
  ELSE
    DELETE FROM vehicle_interest WHERE user_id = p_user_id;
    DELETE FROM price_alerts WHERE user_id = p_user_id;
  END IF;

  -- Clear personal settings on profile (row kept for lifecycle)
  UPDATE profiles
  SET
    vehicle_preferences = NULL,
    session_preference = NULL,
    whatsapp_opt_in = FALSE,
    updated_at = NOW()
  WHERE id = p_user_id;
END;
$$;

-- ---------------------------------------------------------------------------
-- Anonymize PII on business records (retained for integrity)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.anonymize_customer_business_pii(p_user_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ref TEXT;
  v_anon_email TEXT;
  v_email_lower TEXT;
BEGIN
  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'User id is required';
  END IF;

  v_ref := anonymized_customer_ref(p_user_id);
  v_anon_email := anonymized_customer_email(p_user_id);

  SELECT lower(trim(email))
  INTO v_email_lower
  FROM profiles
  WHERE id = p_user_id;

  IF v_email_lower IS NULL OR v_email_lower = '' THEN
    SELECT lower(trim(email))
    INTO v_email_lower
    FROM auth.users
    WHERE id = p_user_id;
  END IF;

  -- Parts orders
  UPDATE parts_orders
  SET
    email = v_anon_email,
    customer_name = v_ref,
    phone = NULL,
    shipping_address = NULL,
    notes = CASE
      WHEN notes IS NOT NULL THEN '[anonymized] ' || left(notes, 200)
      ELSE NULL
    END
  WHERE user_id = p_user_id
     OR (v_email_lower IS NOT NULL AND lower(trim(email)) = v_email_lower);

  -- Pre-orders and inquiries
  UPDATE preorder_inquiries
  SET
    email = v_anon_email,
    name = v_ref,
    phone = NULL,
    message = CASE
      WHEN message IS NOT NULL THEN '[anonymized]'
      ELSE NULL
    END
  WHERE user_id = p_user_id
     OR (v_email_lower IS NOT NULL AND lower(trim(email)) = v_email_lower);

  UPDATE freight_quote_requests
  SET
    email = v_anon_email,
    name = v_ref,
    phone = NULL,
    cargo_description = CASE
      WHEN cargo_description IS NOT NULL THEN '[anonymized]'
      ELSE NULL
    END
  WHERE user_id = p_user_id
     OR (v_email_lower IS NOT NULL AND lower(trim(email)) = v_email_lower);

  UPDATE finance_applications
  SET
    email = v_anon_email,
    first_name = 'Deleted',
    last_name = 'User',
    phone = v_ref,
    notes = CASE WHEN notes IS NOT NULL THEN '[anonymized]' ELSE NULL END
  WHERE user_id = p_user_id
     OR (v_email_lower IS NOT NULL AND lower(trim(email)) = v_email_lower);

  UPDATE vehicle_appointments
  SET
    email = v_anon_email,
    name = v_ref,
    phone = NULL,
    notes = CASE WHEN notes IS NOT NULL THEN '[anonymized]' ELSE NULL END
  WHERE user_id = p_user_id
     OR (v_email_lower IS NOT NULL AND lower(trim(email)) = v_email_lower);

  UPDATE shipment_tracking
  SET
    customer_email = v_anon_email,
    customer_name = v_ref,
    customer_phone = NULL,
    notes = CASE WHEN notes IS NOT NULL THEN '[anonymized]' ELSE NULL END
  WHERE user_id = p_user_id
     OR (v_email_lower IS NOT NULL AND lower(trim(coalesce(customer_email, ''))) = v_email_lower);

  UPDATE contact_inquiries
  SET
    email = v_anon_email,
    name = v_ref,
    phone = NULL,
    message = CASE WHEN message IS NOT NULL THEN '[anonymized]' ELSE NULL END
  WHERE v_email_lower IS NOT NULL AND lower(trim(email)) = v_email_lower;

  UPDATE vehicle_inquiries
  SET
    email = v_anon_email,
    name = v_ref,
    phone = NULL,
    message = CASE WHEN message IS NOT NULL THEN '[anonymized]' ELSE NULL END
  WHERE v_email_lower IS NOT NULL AND lower(trim(email)) = v_email_lower;

  -- Profile row (keep registration_id for business cross-reference)
  UPDATE profiles
  SET
    first_name = 'Deleted',
    last_name = 'User',
    phone = NULL,
    email = v_anon_email,
    is_anonymized = TRUE,
    anonymized_at = COALESCE(anonymized_at, NOW()),
    updated_at = NOW()
  WHERE id = p_user_id;

  IF v_email_lower IS NOT NULL AND v_email_lower <> '' THEN
    INSERT INTO deleted_customer_emails (email, deleted_by)
    VALUES (v_email_lower, 'account_lifecycle')
    ON CONFLICT (email) DO UPDATE
    SET deleted_at = NOW(), deleted_by = EXCLUDED.deleted_by;
  END IF;
END;
$$;

-- ---------------------------------------------------------------------------
-- Request soft deletion (primary customer path)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.request_account_deletion(
  p_user_id UUID,
  p_reason TEXT DEFAULT NULL,
  p_feedback JSONB DEFAULT NULL,
  p_retention_days INTEGER DEFAULT 30,
  p_ip_address INET DEFAULT NULL
)
RETURNS TABLE (
  retention_expires_at TIMESTAMPTZ,
  scheduled_deletion_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_now TIMESTAMPTZ := NOW();
  v_days INTEGER;
  v_expires TIMESTAMPTZ;
  v_status TEXT;
BEGIN
  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'User id is required';
  END IF;

  v_days := GREATEST(COALESCE(p_retention_days, 30), 1);

  SELECT account_status
  INTO v_status
  FROM profiles
  WHERE id = p_user_id;

  IF v_status IS NULL THEN
    RAISE EXCEPTION 'Customer profile not found';
  END IF;

  IF v_status = 'pending_deletion' THEN
    RAISE EXCEPTION 'Account deletion is already pending';
  END IF;

  IF v_status IN ('archived', 'deleted') THEN
    RAISE EXCEPTION 'Account has already been deleted';
  END IF;

  v_expires := v_now + make_interval(days => v_days);

  PERFORM purge_customer_personal_data(p_user_id);

  UPDATE profiles
  SET
    account_status = 'pending_deletion',
    deletion_requested_at = v_now,
    scheduled_deletion_at = v_expires,
    retention_expires_at = v_expires,
    deletion_reason = NULLIF(trim(p_reason), ''),
    deletion_feedback = p_feedback,
    updated_at = v_now
  WHERE id = p_user_id;

  PERFORM log_account_lifecycle_event(
    'deletion_requested',
    p_user_id,
    NULL,
    p_ip_address,
    jsonb_build_object(
      'reason', p_reason,
      'retention_days', v_days,
      'retention_expires_at', v_expires
    )
  );

  retention_expires_at := v_expires;
  scheduled_deletion_at := v_expires;
  RETURN NEXT;
END;
$$;

-- ---------------------------------------------------------------------------
-- Cancel pending deletion (within retention)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.cancel_account_deletion(
  p_user_id UUID,
  p_ip_address INET DEFAULT NULL,
  p_administrator_id UUID DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_status TEXT;
  v_expires TIMESTAMPTZ;
BEGIN
  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'User id is required';
  END IF;

  SELECT account_status, retention_expires_at
  INTO v_status, v_expires
  FROM profiles
  WHERE id = p_user_id;

  IF v_status IS DISTINCT FROM 'pending_deletion' THEN
    RAISE EXCEPTION 'No pending deletion to cancel';
  END IF;

  IF v_expires IS NOT NULL AND v_expires < NOW() THEN
    RAISE EXCEPTION 'Retention period has expired';
  END IF;

  UPDATE profiles
  SET
    account_status = 'active',
    deletion_requested_at = NULL,
    scheduled_deletion_at = NULL,
    retention_expires_at = NULL,
    deletion_reason = NULL,
    deletion_feedback = NULL,
    updated_at = NOW()
  WHERE id = p_user_id;

  PERFORM log_account_lifecycle_event(
    CASE WHEN p_administrator_id IS NULL THEN 'deletion_cancelled' ELSE 'account_restored' END,
    p_user_id,
    p_administrator_id,
    p_ip_address,
    '{}'::jsonb
  );
END;
$$;

-- ---------------------------------------------------------------------------
-- Final anonymization after retention (or admin-triggered)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.execute_account_anonymization(
  p_user_id UUID,
  p_administrator_id UUID DEFAULT NULL,
  p_ip_address INET DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_now TIMESTAMPTZ := NOW();
BEGIN
  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'User id is required';
  END IF;

  PERFORM anonymize_customer_business_pii(p_user_id);

  UPDATE profiles
  SET
    account_status = 'archived',
    deleted_at = COALESCE(deleted_at, v_now),
    is_anonymized = TRUE,
    anonymized_at = COALESCE(anonymized_at, v_now),
    updated_at = v_now
  WHERE id = p_user_id;

  PERFORM log_account_lifecycle_event(
    'personal_data_anonymized',
    p_user_id,
    p_administrator_id,
    p_ip_address,
    jsonb_build_object('finalized_at', v_now)
  );
END;
$$;

-- ---------------------------------------------------------------------------
-- Batch: process accounts past retention
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.process_expired_deletions()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row RECORD;
  v_count INTEGER := 0;
BEGIN
  FOR v_row IN
    SELECT id
    FROM profiles
    WHERE account_status = 'pending_deletion'
      AND retention_expires_at IS NOT NULL
      AND retention_expires_at < NOW()
    ORDER BY retention_expires_at ASC
    LIMIT 200
  LOOP
    PERFORM execute_account_anonymization(v_row.id, NULL, NULL);

    PERFORM log_account_lifecycle_event(
      'retention_expired',
      v_row.id,
      NULL,
      NULL,
      jsonb_build_object('processed_at', NOW())
    );

    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END;
$$;

-- ---------------------------------------------------------------------------
-- Deprecate 068 hard-delete: route through lifecycle final step
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.delete_customer_account_data(p_user_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Legacy entry point — now performs anonymization instead of hard delete.
  PERFORM execute_account_anonymization(p_user_id, NULL, NULL);
END;
$$;

REVOKE ALL ON FUNCTION public.log_account_lifecycle_event(TEXT, UUID, UUID, INET, JSONB) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.purge_customer_personal_data(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.anonymize_customer_business_pii(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.request_account_deletion(UUID, TEXT, JSONB, INTEGER, INET) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.cancel_account_deletion(UUID, INET, UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.execute_account_anonymization(UUID, UUID, INET) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.process_expired_deletions() FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.log_account_lifecycle_event(TEXT, UUID, UUID, INET, JSONB) TO service_role;
GRANT EXECUTE ON FUNCTION public.purge_customer_personal_data(UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.anonymize_customer_business_pii(UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.request_account_deletion(UUID, TEXT, JSONB, INTEGER, INET) TO service_role;
GRANT EXECUTE ON FUNCTION public.cancel_account_deletion(UUID, INET, UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.execute_account_anonymization(UUID, UUID, INET) TO service_role;
GRANT EXECUTE ON FUNCTION public.process_expired_deletions() TO service_role;
GRANT EXECUTE ON FUNCTION public.delete_customer_account_data(UUID) TO service_role;

COMMENT ON FUNCTION public.request_account_deletion IS
  'Soft-delete customer account: purge personal data, set pending_deletion with retention window.';
COMMENT ON FUNCTION public.cancel_account_deletion IS
  'Cancel a pending account deletion within the retention period.';
COMMENT ON FUNCTION public.execute_account_anonymization IS
  'Anonymize retained business records and mark account archived.';
COMMENT ON FUNCTION public.process_expired_deletions IS
  'Daily job: finalize accounts whose retention period has expired.';
COMMENT ON FUNCTION public.delete_customer_account_data IS
  'Deprecated hard-delete — now delegates to execute_account_anonymization.';


-- ─── 071_push_subscriptions.sql ───
-- Web Push subscription storage (VAPID delivery prepared; no sender wired yet)

CREATE TABLE IF NOT EXISTS push_subscriptions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  customer_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  platform_user_id UUID REFERENCES platform_users(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL UNIQUE,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('customer', 'admin')),
  expiration_time BIGINT,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT push_subscriptions_subject_check CHECK (
    (role = 'customer' AND customer_user_id IS NOT NULL AND platform_user_id IS NULL)
    OR (role = 'admin' AND platform_user_id IS NOT NULL AND customer_user_id IS NULL)
  )
);

CREATE INDEX IF NOT EXISTS idx_push_subscriptions_customer
  ON push_subscriptions(customer_user_id)
  WHERE customer_user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_push_subscriptions_platform
  ON push_subscriptions(platform_user_id)
  WHERE platform_user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_push_subscriptions_role
  ON push_subscriptions(role);

ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "No public access to push subscriptions" ON push_subscriptions;
CREATE POLICY "No public access to push subscriptions"
  ON push_subscriptions FOR ALL USING (false) WITH CHECK (false);


-- ─── 072_admin_passkeys.sql ───
-- Admin WebAuthn passkeys, challenges, and backup recovery codes (service role only)

CREATE TABLE IF NOT EXISTS platform_user_passkeys (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  platform_user_id UUID NOT NULL REFERENCES platform_users(id) ON DELETE CASCADE,
  credential_id TEXT NOT NULL UNIQUE,
  public_key TEXT NOT NULL,
  counter BIGINT NOT NULL DEFAULT 0,
  device_name TEXT,
  transports TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_used_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_platform_user_passkeys_user
  ON platform_user_passkeys(platform_user_id);

CREATE TABLE IF NOT EXISTS platform_webauthn_challenges (
  challenge TEXT PRIMARY KEY,
  platform_user_id UUID REFERENCES platform_users(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('registration', 'authentication')),
  expires_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_platform_webauthn_challenges_expires
  ON platform_webauthn_challenges(expires_at);

CREATE INDEX IF NOT EXISTS idx_platform_webauthn_challenges_user
  ON platform_webauthn_challenges(platform_user_id)
  WHERE platform_user_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS platform_user_backup_codes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  platform_user_id UUID NOT NULL REFERENCES platform_users(id) ON DELETE CASCADE,
  code_hash TEXT NOT NULL,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_platform_user_backup_codes_user
  ON platform_user_backup_codes(platform_user_id)
  WHERE used_at IS NULL;

ALTER TABLE platform_user_passkeys ENABLE ROW LEVEL SECURITY;
ALTER TABLE platform_webauthn_challenges ENABLE ROW LEVEL SECURITY;
ALTER TABLE platform_user_backup_codes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "No public access to platform user passkeys" ON platform_user_passkeys;
CREATE POLICY "No public access to platform user passkeys"
  ON platform_user_passkeys FOR ALL USING (false) WITH CHECK (false);

DROP POLICY IF EXISTS "No public access to platform webauthn challenges" ON platform_webauthn_challenges;
CREATE POLICY "No public access to platform webauthn challenges"
  ON platform_webauthn_challenges FOR ALL USING (false) WITH CHECK (false);

DROP POLICY IF EXISTS "No public access to platform user backup codes" ON platform_user_backup_codes;
CREATE POLICY "No public access to platform user backup codes"
  ON platform_user_backup_codes FOR ALL USING (false) WITH CHECK (false);


-- ─── 073_security_hardening.sql ───
-- Phase 2 security hardening: SECURITY DEFINER RPCs must not inherit PUBLIC execute.
-- The application invokes these functions through the server-only service-role client.

REVOKE ALL ON FUNCTION public.claim_support_ticket(UUID, UUID, BOOLEAN) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.claim_support_ticket(UUID, UUID, BOOLEAN) FROM anon;
REVOKE ALL ON FUNCTION public.claim_support_ticket(UUID, UUID, BOOLEAN) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.claim_support_ticket(UUID, UUID, BOOLEAN) TO service_role;

REVOKE ALL ON FUNCTION public.reopen_support_ticket(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.reopen_support_ticket(UUID) FROM anon;
REVOKE ALL ON FUNCTION public.reopen_support_ticket(UUID) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.reopen_support_ticket(UUID) TO service_role;


-- ─── 074_phase4_query_indexes.sql ───
-- Phase 4: indexes for observed list/detail query shapes.
-- Apply in a staging/maintenance window first and validate with EXPLAIN
-- (ANALYZE, BUFFERS). Index creation can lock writes on large tables.
--
-- Reversal:
--   DROP INDEX IF EXISTS idx_vehicles_public_created;
--   DROP INDEX IF EXISTS idx_profiles_active_created;
--   DROP INDEX IF EXISTS idx_parts_orders_active_created;
--   DROP INDEX IF EXISTS idx_contact_inquiries_active_created;
--   DROP INDEX IF EXISTS idx_vehicle_inquiries_active_created;
--   DROP INDEX IF EXISTS idx_finance_applications_active_created;
--   DROP INDEX IF EXISTS idx_appraisal_requests_active_created;
--   DROP INDEX IF EXISTS idx_preorder_user_active_created;
--   DROP INDEX IF EXISTS idx_freight_quotes_user_created;
--   DROP INDEX IF EXISTS idx_shipment_tracking_user_created;

CREATE INDEX IF NOT EXISTS idx_vehicles_public_created
  ON vehicles (approval_status, status, created_at DESC)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_profiles_active_created
  ON profiles (created_at DESC)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_parts_orders_active_created
  ON parts_orders (created_at DESC)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_contact_inquiries_active_created
  ON contact_inquiries (created_at DESC)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_vehicle_inquiries_active_created
  ON vehicle_inquiries (created_at DESC)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_finance_applications_active_created
  ON finance_applications (created_at DESC)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_appraisal_requests_active_created
  ON appraisal_requests (created_at DESC)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_preorder_user_active_created
  ON preorder_inquiries (user_id, created_at DESC)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_freight_quotes_user_created
  ON freight_quote_requests (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_shipment_tracking_user_created
  ON shipment_tracking (user_id, created_at DESC);


-- ─── 075_admin_notification_dismissals.sql ───
-- Persist read/dismiss state for synthetic admin notifications (low-stock, delivery log alerts).

CREATE TABLE IF NOT EXISTS admin_notification_dismissals (
  scope TEXT NOT NULL,
  notification_key TEXT NOT NULL,
  dismissed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (scope, notification_key)
);

CREATE INDEX IF NOT EXISTS idx_admin_notification_dismissals_scope_dismissed
  ON admin_notification_dismissals (scope, dismissed_at DESC);

ALTER TABLE admin_notification_dismissals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "No public access to admin notification dismissals" ON admin_notification_dismissals;
CREATE POLICY "No public access to admin notification dismissals"
  ON admin_notification_dismissals FOR ALL USING (false) WITH CHECK (false);


-- ─── 076_inventory_movements.sql ───
-- Inventory & business movement ledger — trace stock and financial flows over time.
-- Apply via Supabase CLI or SQL editor if not auto-deployed.

CREATE TABLE IF NOT EXISTS inventory_movements (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  direction TEXT NOT NULL CHECK (direction IN ('in', 'out')),
  asset_type TEXT NOT NULL CHECK (
    asset_type IN ('vehicle', 'part', 'expense', 'sale', 'preorder', 'order')
  ),
  movement_type TEXT NOT NULL,
  description TEXT NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  amount_usd INTEGER NOT NULL DEFAULT 0,
  asset_id UUID,
  reference_type TEXT,
  reference_id UUID,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  source TEXT NOT NULL DEFAULT 'system' CHECK (source IN ('system', 'backfill', 'manual')),
  created_by_user_id UUID REFERENCES platform_users(id) ON DELETE SET NULL,
  created_by_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_inventory_movements_dedup
  ON inventory_movements (movement_type, reference_type, reference_id)
  WHERE reference_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_inventory_movements_occurred_at
  ON inventory_movements (occurred_at DESC);

CREATE INDEX IF NOT EXISTS idx_inventory_movements_asset_type
  ON inventory_movements (asset_type);

CREATE INDEX IF NOT EXISTS idx_inventory_movements_direction
  ON inventory_movements (direction);

CREATE INDEX IF NOT EXISTS idx_inventory_movements_movement_type
  ON inventory_movements (movement_type);

ALTER TABLE inventory_movements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role manages inventory_movements" ON inventory_movements;
CREATE POLICY "Service role manages inventory_movements"
  ON inventory_movements FOR ALL USING (false) WITH CHECK (false);


-- ─── 077_whatsapp_delivery_tracking.sql ───
-- WhatsApp delivery tracking, webhook replay protection, and API settings seeds.
-- Idempotent. Service-role only (RLS deny-all for anon/authenticated).

-- ---------------------------------------------------------------------------
-- notification_log: delivery tracking columns + wider statuses
-- ---------------------------------------------------------------------------

ALTER TABLE notification_log
  ADD COLUMN IF NOT EXISTS provider TEXT,
  ADD COLUMN IF NOT EXISTS provider_message_id TEXT,
  ADD COLUMN IF NOT EXISTS idempotency_key TEXT,
  ADD COLUMN IF NOT EXISTS retry_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS next_retry_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS delivered_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS read_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS error_code TEXT,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

ALTER TABLE notification_log DROP CONSTRAINT IF EXISTS notification_log_status_check;
ALTER TABLE notification_log ADD CONSTRAINT notification_log_status_check
  CHECK (status IN (
    'queued',
    'sent',
    'delivered',
    'read',
    'failed',
    'skipped',
    'deferred',
    'undeliverable'
  ));

CREATE UNIQUE INDEX IF NOT EXISTS idx_notification_log_idempotency
  ON notification_log (idempotency_key)
  WHERE idempotency_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_notification_log_provider_message
  ON notification_log (provider_message_id)
  WHERE provider_message_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_notification_log_retry
  ON notification_log (next_retry_at)
  WHERE next_retry_at IS NOT NULL AND status IN ('queued', 'failed');

CREATE INDEX IF NOT EXISTS idx_notification_log_status_created
  ON notification_log (status, created_at DESC);

-- ---------------------------------------------------------------------------
-- whatsapp_webhook_events: Meta webhook replay protection
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS whatsapp_webhook_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_id TEXT NOT NULL,
  event_type TEXT,
  payload JSONB,
  processed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_whatsapp_webhook_events_event_id
  ON whatsapp_webhook_events (event_id);

CREATE INDEX IF NOT EXISTS idx_whatsapp_webhook_events_created
  ON whatsapp_webhook_events (created_at DESC);

ALTER TABLE whatsapp_webhook_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role manages whatsapp_webhook_events" ON whatsapp_webhook_events;
CREATE POLICY "Service role manages whatsapp_webhook_events"
  ON whatsapp_webhook_events FOR ALL USING (false) WITH CHECK (false);

-- ---------------------------------------------------------------------------
-- site_settings seeds (VERIFY_TOKEN / APP_SECRET stay env-only)
-- ---------------------------------------------------------------------------

INSERT INTO site_settings (key, value) VALUES
  ('whatsapp_enabled', 'true'),
  ('whatsapp_business_account_id', ''),
  ('whatsapp_default_country', 'GH'),
  ('notify_team_whatsapp_enabled', 'true'),
  ('whatsapp_template_password_reset', 'password_reset'),
  ('whatsapp_template_team_invite', 'team_invite'),
  ('whatsapp_template_team_welcome', 'team_welcome'),
  ('whatsapp_template_team_role_changed', 'team_role_changed'),
  ('whatsapp_template_team_password_set', 'team_password_set'),
  ('whatsapp_template_language', 'en')
ON CONFLICT (key) DO NOTHING;


-- ─── 078_platform_user_soft_delete.sql ───
-- Soft-delete for platform team users (Users & roles → Trash restore).

ALTER TABLE platform_users
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS deleted_by_user_id UUID REFERENCES platform_users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_platform_users_deleted_at
  ON platform_users (deleted_at)
  WHERE deleted_at IS NOT NULL;

-- Free the email for re-invite after soft-delete (keep UNIQUE only for active rows).
ALTER TABLE platform_users DROP CONSTRAINT IF EXISTS platform_users_email_key;
DROP INDEX IF EXISTS platform_users_email_key;

CREATE UNIQUE INDEX IF NOT EXISTS platform_users_email_active_unique
  ON platform_users (lower(email))
  WHERE deleted_at IS NULL;


-- ─── 079_support_ticket_soft_delete.sql ───
-- Soft-delete for customer support tickets (Platform → Messages).
-- Tickets move to platform_trash and can be restored.

ALTER TABLE customer_conversations
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS deleted_by_user_id UUID REFERENCES platform_users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_customer_conversations_deleted_at
  ON customer_conversations (deleted_at)
  WHERE deleted_at IS NOT NULL;


-- ─── 080_admin_notification_soft_delete.sql ───
-- Soft-delete for persisted admin notifications (Platform → Notifications → Trash).

ALTER TABLE admin_notifications
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS deleted_by_user_id UUID REFERENCES platform_users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_admin_notifications_deleted_at
  ON admin_notifications (deleted_at)
  WHERE deleted_at IS NOT NULL;


-- ─── 081_vehicle_price_currency.sql ───
-- Per-listing price currency: amount entered may be GHS/EUR/etc.;
-- vehicles.price remains the canonical USD integer used for filters, sorting, and FX display.

ALTER TABLE vehicles
  ADD COLUMN IF NOT EXISTS price_currency TEXT NOT NULL DEFAULT 'USD';

ALTER TABLE vehicles
  ADD COLUMN IF NOT EXISTS listed_price INTEGER;

COMMENT ON COLUMN vehicles.price IS
  'Canonical list price in USD (filters, sorting, FX conversion base).';

COMMENT ON COLUMN vehicles.price_currency IS
  'ISO 4217 currency the seller entered for listed_price (e.g. GHS, USD, EUR).';

COMMENT ON COLUMN vehicles.listed_price IS
  'Exact amount as entered in price_currency. NULL = legacy row where price is the entered USD amount.';

-- Backfill listed_price for existing USD-priced inventory.
UPDATE vehicles
SET listed_price = price
WHERE listed_price IS NULL
  AND price_currency = 'USD';


-- ─── 082_vehicle_stock_quantity.sql ───
-- Per-listing stock quantity: number of identical units available for one listing
-- (same make + model + year). Lets admins record e.g. 2× 2019 units on a single
-- listing instead of duplicating rows. Existing rows default to 1 unit.

ALTER TABLE vehicles
  ADD COLUMN IF NOT EXISTS stock_quantity INTEGER NOT NULL DEFAULT 1;

ALTER TABLE vehicles
  DROP CONSTRAINT IF EXISTS vehicles_stock_quantity_check;

ALTER TABLE vehicles
  ADD CONSTRAINT vehicles_stock_quantity_check CHECK (stock_quantity >= 0);

COMMENT ON COLUMN vehicles.stock_quantity IS
  'Units in stock for this listing. Low-stock alerts and model availability counts sum this per make/model/year.';


-- ─── 083_admin_interaction_indexes.sql ───
-- Admin interaction performance indexes (2026-07-28 audit).
-- DO NOT apply remotely from CI/agent — run in Supabase SQL Editor after review.
--
-- Evidence: open-status counts and lead pipeline filters on finance/appraisal lack
-- status-leading indexes (unlike contact/vehicle/preorder in 049_performance_indexes).
-- Recipient-scoped admin_notifications lists filter by recipient + created_at.
--
-- Soft-delete: finance_applications / appraisal_requests / vehicles get deleted_at
-- from 054_platform_trash. admin_notifications gets it from 080 — ensure columns
-- here so this script is safe if 080 was never applied on the remote DB.
--
-- Reversal:
--   DROP INDEX IF EXISTS idx_finance_applications_status_created;
--   DROP INDEX IF EXISTS idx_appraisal_requests_status_created;
--   DROP INDEX IF EXISTS idx_admin_notifications_recipient_user_created;
--   DROP INDEX IF EXISTS idx_admin_notifications_recipient_owner_created;
--   DROP INDEX IF EXISTS idx_vehicles_available_stock;

-- Ensure soft-delete columns exist before partial indexes that filter on them.
ALTER TABLE admin_notifications
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS deleted_by_user_id UUID REFERENCES platform_users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_admin_notifications_deleted_at
  ON admin_notifications (deleted_at)
  WHERE deleted_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_finance_applications_status_created
  ON finance_applications (status, created_at DESC)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_appraisal_requests_status_created
  ON appraisal_requests (status, created_at DESC)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_admin_notifications_recipient_user_created
  ON admin_notifications (recipient_user_id, created_at DESC)
  WHERE deleted_at IS NULL AND recipient_user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_admin_notifications_recipient_owner_created
  ON admin_notifications (created_at DESC)
  WHERE deleted_at IS NULL AND recipient_is_owner = true;

-- Speeds countAvailableVehicleUnits / fleet stock scans (status=available).
CREATE INDEX IF NOT EXISTS idx_vehicles_available_stock
  ON vehicles (status)
  INCLUDE (stock_quantity)
  WHERE deleted_at IS NULL AND status = 'available';

-- Optional follow-up (manual): replace Node-side stock sum with
--   SELECT COALESCE(SUM(COALESCE(stock_quantity, 1)), 0) FROM vehicles
--   WHERE deleted_at IS NULL AND status = 'available';
-- via a SECURITY DEFINER RPC if fleet size grows past a few hundred rows.


-- ─── 084_platform_error_log.sql ───
-- Enterprise error log — persisted store behind the admin Error Log screen.
-- DO NOT apply remotely from CI/agent — run in the Supabase SQL Editor after review.
--
-- The application degrades gracefully without this table: `src/lib/errors/logger.ts`
-- detects a missing relation on its first insert, disables persistence for that
-- instance, and continues with structured console logging only. Nothing breaks
-- if this migration has not been run yet.
--
-- Privacy: `request_body` is written through `src/lib/errors/sanitize.ts`, which
-- redacts passwords/tokens/keys, masks emails and phone numbers, and replaces
-- free-text fields with a length marker. No secrets are stored here.
--
-- Reversal:
--   DROP TABLE IF EXISTS platform_error_log;

CREATE TABLE IF NOT EXISTS platform_error_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  -- Support-facing correlation id, format TG-XXXXXX.
  error_id TEXT NOT NULL,
  severity TEXT NOT NULL DEFAULT 'high'
    CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  kind TEXT NOT NULL DEFAULT 'unknown',
  status INTEGER NOT NULL DEFAULT 500,
  -- Dotted handler path, e.g. api.admin.vehicles.PATCH.
  module TEXT NOT NULL,
  method TEXT,
  route TEXT,
  -- Exactly what the user was shown.
  user_message TEXT,
  -- Raw provider/database text — admin-only, never returned to a client.
  internal_message TEXT,
  db_code TEXT,
  actor_id UUID,
  actor_role TEXT,
  ip TEXT,
  browser TEXT,
  os TEXT,
  environment TEXT,
  release TEXT,
  stack TEXT,
  request_body JSONB,
  context JSONB NOT NULL DEFAULT '{}'::jsonb,
  resolved_at TIMESTAMPTZ,
  resolved_by_user_id UUID REFERENCES platform_users(id) ON DELETE SET NULL,
  resolution_note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Support flow: a customer quotes TG-XXXXXX and staff look it up directly.
CREATE UNIQUE INDEX IF NOT EXISTS idx_platform_error_log_error_id
  ON platform_error_log (error_id);

CREATE INDEX IF NOT EXISTS idx_platform_error_log_created_at
  ON platform_error_log (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_platform_error_log_severity_created
  ON platform_error_log (severity, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_platform_error_log_module_created
  ON platform_error_log (module, created_at DESC);

-- Default list view is "unresolved, newest first".
CREATE INDEX IF NOT EXISTS idx_platform_error_log_unresolved
  ON platform_error_log (created_at DESC)
  WHERE resolved_at IS NULL;

ALTER TABLE platform_error_log ENABLE ROW LEVEL SECURITY;

-- Service-role only, matching every other platform-internal table.
DROP POLICY IF EXISTS "Service role manages platform_error_log" ON platform_error_log;
CREATE POLICY "Service role manages platform_error_log"
  ON platform_error_log FOR ALL USING (false) WITH CHECK (false);

-- Optional retention job (run manually or schedule with pg_cron):
--   DELETE FROM platform_error_log
--   WHERE resolved_at IS NOT NULL AND created_at < NOW() - INTERVAL '180 days';


-- ─── 085_maintenance_mode.sql ───
-- Enterprise maintenance mode audit keys (site_settings key-value store).
-- Soft-fail safe: app defaults if these keys are missing during rollout.
--
-- Existing keys (from 034_platform_settings_expand.sql):
--   maintenance_mode, maintenance_message
--
-- This migration adds who/when metadata for enable/disable events.
-- Activity detail also goes to platform_activity_log from the settings API.

INSERT INTO site_settings (key, value) VALUES
  ('maintenance_mode', 'false'),
  (
    'maintenance_message',
    'We are performing scheduled maintenance. Some features may be temporarily unavailable.'
  ),
  ('maintenance_enabled_by', ''),
  ('maintenance_enabled_at', ''),
  ('maintenance_disabled_by', ''),
  ('maintenance_disabled_at', ''),
  ('maintenance_updated_by', ''),
  ('maintenance_updated_at', '')
ON CONFLICT (key) DO NOTHING;

-- Keep public read of the visitor-facing flags (policy recreate is idempotent).
DROP POLICY IF EXISTS "Public operational site_settings are readable" ON site_settings;
CREATE POLICY "Public operational site_settings are readable"
  ON site_settings FOR SELECT
  USING (
    key IN (
      'clearing_fee_notice',
      'preorder_terms_a',
      'preorder_terms_b',
      'preorder_terms_c',
      'maintenance_mode',
      'maintenance_message',
      'freight_default_origins',
      'freight_cargo_options',
      'feature_show_spare_parts_nav',
      'feature_show_freight_nav',
      'appointment_branches',
      'phone',
      'email',
      'whatsapp_number',
      'company_name',
      'hours_weekday',
      'hours_saturday',
      'hours_sunday'
    )
  );

COMMENT ON TABLE site_settings IS
  'Key-value operational settings. Maintenance: maintenance_mode, maintenance_message, maintenance_*_by/at audit keys.';


-- ─── 086_postgres_error_clearance.sql ───
-- =============================================================================
-- 086 — Postgres error clearance (idempotent catch-up for 075–085)
-- =============================================================================
-- Paste once in Supabase SQL Editor for project ddrknhvkhmgdtavpuiiq.
-- Safe to re-run: IF NOT EXISTS / ON CONFLICT DO NOTHING throughout.
--
-- Clears production Postgres log spam from app queries against schema that
-- shipped in code but was never applied remotely:
--   42703  undefined_column  (deleted_at, stock_quantity, price_currency, …)
--   42P01 / PGRST205         (inventory_movements, dismissals, error_log, …)
--
-- After success: Dashboard → Logs → Postgres → confirm new errors stop.
-- Also reloads PostgREST schema cache at the end.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Soft-delete columns (054 / 078 / 079 / 080) — only adds if missing
-- ---------------------------------------------------------------------------

ALTER TABLE vehicles
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS deleted_by_user_id UUID REFERENCES platform_users(id) ON DELETE SET NULL;

ALTER TABLE expenses
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS deleted_by_user_id UUID REFERENCES platform_users(id) ON DELETE SET NULL;

ALTER TABLE sales
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS deleted_by_user_id UUID REFERENCES platform_users(id) ON DELETE SET NULL;

ALTER TABLE parts_orders
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS deleted_by_user_id UUID REFERENCES platform_users(id) ON DELETE SET NULL;

ALTER TABLE preorder_inquiries
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS deleted_by_user_id UUID REFERENCES platform_users(id) ON DELETE SET NULL;

ALTER TABLE contact_inquiries
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS deleted_by_user_id UUID REFERENCES platform_users(id) ON DELETE SET NULL;

ALTER TABLE finance_applications
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS deleted_by_user_id UUID REFERENCES platform_users(id) ON DELETE SET NULL;

ALTER TABLE appraisal_requests
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS deleted_by_user_id UUID REFERENCES platform_users(id) ON DELETE SET NULL;

ALTER TABLE vehicle_inquiries
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS deleted_by_user_id UUID REFERENCES platform_users(id) ON DELETE SET NULL;

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS deleted_by_user_id UUID REFERENCES platform_users(id) ON DELETE SET NULL;

ALTER TABLE platform_users
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS deleted_by_user_id UUID REFERENCES platform_users(id) ON DELETE SET NULL;

ALTER TABLE customer_conversations
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS deleted_by_user_id UUID REFERENCES platform_users(id) ON DELETE SET NULL;

ALTER TABLE admin_notifications
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS deleted_by_user_id UUID REFERENCES platform_users(id) ON DELETE SET NULL;

-- Soft-delete indexes
CREATE INDEX IF NOT EXISTS idx_vehicles_deleted_at
  ON vehicles (deleted_at) WHERE deleted_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_platform_users_deleted_at
  ON platform_users (deleted_at) WHERE deleted_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_customer_conversations_deleted_at
  ON customer_conversations (deleted_at) WHERE deleted_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_admin_notifications_deleted_at
  ON admin_notifications (deleted_at) WHERE deleted_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_profiles_deleted_at
  ON profiles (deleted_at) WHERE deleted_at IS NOT NULL;

-- Active-email uniqueness after platform_users soft-delete (078)
ALTER TABLE platform_users DROP CONSTRAINT IF EXISTS platform_users_email_key;
DROP INDEX IF EXISTS platform_users_email_key;
CREATE UNIQUE INDEX IF NOT EXISTS platform_users_email_active_unique
  ON platform_users (lower(email))
  WHERE deleted_at IS NULL;

-- ---------------------------------------------------------------------------
-- Vehicle pricing / stock (081 / 082)
-- ---------------------------------------------------------------------------

ALTER TABLE vehicles
  ADD COLUMN IF NOT EXISTS price_currency TEXT NOT NULL DEFAULT 'USD';

ALTER TABLE vehicles
  ADD COLUMN IF NOT EXISTS listed_price INTEGER;

UPDATE vehicles
SET listed_price = price
WHERE listed_price IS NULL
  AND price_currency = 'USD';

ALTER TABLE vehicles
  ADD COLUMN IF NOT EXISTS stock_quantity INTEGER NOT NULL DEFAULT 1;

ALTER TABLE vehicles
  DROP CONSTRAINT IF EXISTS vehicles_stock_quantity_check;

ALTER TABLE vehicles
  ADD CONSTRAINT vehicles_stock_quantity_check CHECK (stock_quantity >= 0);

-- Local vs shipment exclusive (069) — add only when missing and data is clean
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'vehicles_local_shipment_exclusive'
  ) THEN
    IF NOT EXISTS (
      SELECT 1 FROM vehicles
      WHERE available_locally IS TRUE AND shipment_available IS TRUE
    ) THEN
      ALTER TABLE vehicles
        ADD CONSTRAINT vehicles_local_shipment_exclusive
        CHECK (NOT (available_locally = true AND shipment_available = true));
    END IF;
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 075 — admin_notification_dismissals
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS admin_notification_dismissals (
  scope TEXT NOT NULL,
  notification_key TEXT NOT NULL,
  dismissed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (scope, notification_key)
);

CREATE INDEX IF NOT EXISTS idx_admin_notification_dismissals_scope_dismissed
  ON admin_notification_dismissals (scope, dismissed_at DESC);

ALTER TABLE admin_notification_dismissals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "No public access to admin notification dismissals" ON admin_notification_dismissals;
CREATE POLICY "No public access to admin notification dismissals"
  ON admin_notification_dismissals FOR ALL USING (false) WITH CHECK (false);

-- ---------------------------------------------------------------------------
-- 076 — inventory_movements
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS inventory_movements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  direction TEXT NOT NULL CHECK (direction IN ('in', 'out')),
  asset_type TEXT NOT NULL CHECK (
    asset_type IN ('vehicle', 'part', 'expense', 'sale', 'preorder', 'order')
  ),
  movement_type TEXT NOT NULL,
  description TEXT NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  amount_usd INTEGER NOT NULL DEFAULT 0,
  asset_id UUID,
  reference_type TEXT,
  reference_id UUID,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  source TEXT NOT NULL DEFAULT 'system' CHECK (source IN ('system', 'backfill', 'manual')),
  created_by_user_id UUID REFERENCES platform_users(id) ON DELETE SET NULL,
  created_by_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_inventory_movements_dedup
  ON inventory_movements (movement_type, reference_type, reference_id)
  WHERE reference_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_inventory_movements_occurred_at
  ON inventory_movements (occurred_at DESC);

CREATE INDEX IF NOT EXISTS idx_inventory_movements_asset_type
  ON inventory_movements (asset_type);

CREATE INDEX IF NOT EXISTS idx_inventory_movements_direction
  ON inventory_movements (direction);

CREATE INDEX IF NOT EXISTS idx_inventory_movements_movement_type
  ON inventory_movements (movement_type);

ALTER TABLE inventory_movements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role manages inventory_movements" ON inventory_movements;
CREATE POLICY "Service role manages inventory_movements"
  ON inventory_movements FOR ALL USING (false) WITH CHECK (false);

-- ---------------------------------------------------------------------------
-- 083 — admin interaction indexes (require deleted_at above)
-- ---------------------------------------------------------------------------

CREATE INDEX IF NOT EXISTS idx_finance_applications_status_created
  ON finance_applications (status, created_at DESC)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_appraisal_requests_status_created
  ON appraisal_requests (status, created_at DESC)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_admin_notifications_recipient_user_created
  ON admin_notifications (recipient_user_id, created_at DESC)
  WHERE deleted_at IS NULL AND recipient_user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_admin_notifications_recipient_owner_created
  ON admin_notifications (created_at DESC)
  WHERE deleted_at IS NULL AND recipient_is_owner = true;

CREATE INDEX IF NOT EXISTS idx_vehicles_available_stock
  ON vehicles (status)
  INCLUDE (stock_quantity)
  WHERE deleted_at IS NULL AND status = 'available';

-- ---------------------------------------------------------------------------
-- 084 — platform_error_log
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS platform_error_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  error_id TEXT NOT NULL,
  severity TEXT NOT NULL DEFAULT 'high'
    CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  kind TEXT NOT NULL DEFAULT 'unknown',
  status INTEGER NOT NULL DEFAULT 500,
  module TEXT NOT NULL,
  method TEXT,
  route TEXT,
  user_message TEXT,
  internal_message TEXT,
  db_code TEXT,
  actor_id UUID,
  actor_role TEXT,
  ip TEXT,
  browser TEXT,
  os TEXT,
  environment TEXT,
  release TEXT,
  stack TEXT,
  request_body JSONB,
  context JSONB NOT NULL DEFAULT '{}'::jsonb,
  resolved_at TIMESTAMPTZ,
  resolved_by_user_id UUID REFERENCES platform_users(id) ON DELETE SET NULL,
  resolution_note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_platform_error_log_error_id
  ON platform_error_log (error_id);

CREATE INDEX IF NOT EXISTS idx_platform_error_log_created_at
  ON platform_error_log (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_platform_error_log_severity_created
  ON platform_error_log (severity, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_platform_error_log_module_created
  ON platform_error_log (module, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_platform_error_log_unresolved
  ON platform_error_log (created_at DESC)
  WHERE resolved_at IS NULL;

ALTER TABLE platform_error_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role manages platform_error_log" ON platform_error_log;
CREATE POLICY "Service role manages platform_error_log"
  ON platform_error_log FOR ALL USING (false) WITH CHECK (false);

-- ---------------------------------------------------------------------------
-- 085 — maintenance mode audit keys
-- ---------------------------------------------------------------------------

INSERT INTO site_settings (key, value) VALUES
  ('maintenance_mode', 'false'),
  (
    'maintenance_message',
    'We are performing scheduled maintenance. Some features may be temporarily unavailable.'
  ),
  ('maintenance_enabled_by', ''),
  ('maintenance_enabled_at', ''),
  ('maintenance_disabled_by', ''),
  ('maintenance_disabled_at', ''),
  ('maintenance_updated_by', ''),
  ('maintenance_updated_at', '')
ON CONFLICT (key) DO NOTHING;

-- ---------------------------------------------------------------------------
-- Reload PostgREST schema cache so new columns/tables are visible immediately
-- ---------------------------------------------------------------------------

NOTIFY pgrst, 'reload schema';


-- ─── 087_iam_auth_foundation.sql ───
-- IAM foundation: login attempts, lockouts, history, sessions, customer MFA
-- Next migration after 086_postgres_error_clearance.sql
--
-- user_id columns hold the customer UUID (profiles.id) as a plain UUID. They
-- carry no foreign key into auth.users: identity is owned by the external
-- provider (see 090_external_auth_migration.sql) and auth is a Supabase-managed
-- schema this role cannot depend on or alter.

-- Failed / successful customer auth attempts (rate limit + lockout + audit)
CREATE TABLE IF NOT EXISTS customer_auth_attempts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email TEXT NOT NULL,
  user_id UUID,
  ip TEXT,
  user_agent TEXT,
  success BOOLEAN NOT NULL DEFAULT false,
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_customer_auth_attempts_email_created
  ON customer_auth_attempts (lower(email), created_at DESC);

CREATE INDEX IF NOT EXISTS idx_customer_auth_attempts_ip_created
  ON customer_auth_attempts (ip, created_at DESC);

-- Account lockouts (temporary)
CREATE TABLE IF NOT EXISTS customer_auth_lockouts (
  email TEXT PRIMARY KEY,
  failed_count INT NOT NULL DEFAULT 0,
  locked_until TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Login history shown in account settings
CREATE TABLE IF NOT EXISTS customer_login_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL,
  email TEXT,
  ip TEXT,
  user_agent TEXT,
  browser TEXT,
  device TEXT,
  os TEXT,
  country TEXT,
  city TEXT,
  success BOOLEAN NOT NULL DEFAULT true,
  method TEXT NOT NULL DEFAULT 'password',
  suspicious BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_customer_login_history_user_created
  ON customer_login_history (user_id, created_at DESC);

-- Active / revocable customer sessions (device inventory)
CREATE TABLE IF NOT EXISTS customer_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL,
  session_fingerprint TEXT NOT NULL,
  refresh_token_hash TEXT,
  ip TEXT,
  user_agent TEXT,
  browser TEXT,
  device TEXT,
  os TEXT,
  country TEXT,
  city TEXT,
  last_active_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  revoked_at TIMESTAMPTZ,
  UNIQUE (user_id, session_fingerprint)
);

CREATE INDEX IF NOT EXISTS idx_customer_sessions_user_active
  ON customer_sessions (user_id, last_active_at DESC)
  WHERE revoked_at IS NULL;

-- Customer TOTP MFA
CREATE TABLE IF NOT EXISTS customer_mfa_totp (
  user_id UUID PRIMARY KEY,
  secret_encrypted TEXT NOT NULL,
  enabled_at TIMESTAMPTZ,
  enforced_by_admin BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS customer_mfa_backup_codes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL,
  code_hash TEXT NOT NULL,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_customer_mfa_backup_codes_user
  ON customer_mfa_backup_codes (user_id)
  WHERE used_at IS NULL;

-- Platform MFA enforce flag (settings-friendly column on platform_users)
ALTER TABLE platform_users
  ADD COLUMN IF NOT EXISTS mfa_required BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE platform_users
  ADD COLUMN IF NOT EXISTS totp_secret_encrypted TEXT;

ALTER TABLE platform_users
  ADD COLUMN IF NOT EXISTS totp_enabled_at TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS platform_mfa_backup_codes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  platform_user_id UUID NOT NULL REFERENCES platform_users(id) ON DELETE CASCADE,
  code_hash TEXT NOT NULL,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_platform_mfa_backup_codes_user
  ON platform_mfa_backup_codes (platform_user_id)
  WHERE used_at IS NULL;

-- RLS: service role only (app uses admin client)
ALTER TABLE customer_auth_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer_auth_lockouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer_login_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer_mfa_totp ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer_mfa_backup_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE platform_mfa_backup_codes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "No public access to customer_auth_attempts" ON customer_auth_attempts;
CREATE POLICY "No public access to customer_auth_attempts"
  ON customer_auth_attempts FOR ALL USING (false) WITH CHECK (false);

DROP POLICY IF EXISTS "No public access to customer_auth_lockouts" ON customer_auth_lockouts;
CREATE POLICY "No public access to customer_auth_lockouts"
  ON customer_auth_lockouts FOR ALL USING (false) WITH CHECK (false);

-- Customers read their own history/sessions/MFA state through server routes that
-- verify the external session, so no auth.uid() policy is possible or needed.
DROP POLICY IF EXISTS "Users can view own login history" ON customer_login_history;
DROP POLICY IF EXISTS "No public insert login history" ON customer_login_history;
DROP POLICY IF EXISTS "No public access to customer_login_history" ON customer_login_history;
CREATE POLICY "No public access to customer_login_history"
  ON customer_login_history FOR ALL USING (false) WITH CHECK (false);

DROP POLICY IF EXISTS "Users can view own sessions" ON customer_sessions;
DROP POLICY IF EXISTS "No public mutate sessions" ON customer_sessions;
CREATE POLICY "No public mutate sessions"
  ON customer_sessions FOR ALL USING (false) WITH CHECK (false);

DROP POLICY IF EXISTS "Users can view own mfa status" ON customer_mfa_totp;
DROP POLICY IF EXISTS "No public mutate customer mfa" ON customer_mfa_totp;
CREATE POLICY "No public mutate customer mfa"
  ON customer_mfa_totp FOR ALL USING (false) WITH CHECK (false);

DROP POLICY IF EXISTS "No public access customer backup codes" ON customer_mfa_backup_codes;
CREATE POLICY "No public access customer backup codes"
  ON customer_mfa_backup_codes FOR ALL USING (false) WITH CHECK (false);

DROP POLICY IF EXISTS "No public access platform mfa backup codes" ON platform_mfa_backup_codes;
CREATE POLICY "No public access platform mfa backup codes"
  ON platform_mfa_backup_codes FOR ALL USING (false) WITH CHECK (false);


-- ─── 088_iam_platform_roles.sql ───
-- Expand platform_users.role for IAM job titles (keeps Owner/Manager/Staff/Super Admin)

ALTER TABLE platform_users DROP CONSTRAINT IF EXISTS platform_users_role_check;

ALTER TABLE platform_users
  ADD CONSTRAINT platform_users_role_check
  CHECK (role IN (
    'owner',
    'super_admin',
    'administrator',
    'manager',
    'sales_officer',
    'inventory_officer',
    'freight_officer',
    'accounts',
    'staff'
  ));

-- Map any lingering display labels
UPDATE platform_users SET role = 'sales_officer' WHERE role IN ('Sales Officer');
UPDATE platform_users SET role = 'accounts' WHERE role IN ('Finance Officer', 'Accounts');
UPDATE platform_users SET role = 'administrator' WHERE role IN ('Administrator');
UPDATE platform_users SET role = 'inventory_officer' WHERE role IN ('Inventory Officer');
UPDATE platform_users SET role = 'freight_officer' WHERE role IN ('Freight Officer');

-- ─── 089_invitation_email_delivery.sql ───
-- Durable Resend delivery state for platform invitations.

ALTER TABLE platform_user_invites
  ADD COLUMN IF NOT EXISTS email_status TEXT NOT NULL DEFAULT 'PENDING',
  ADD COLUMN IF NOT EXISTS sent_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS provider_message_id TEXT,
  ADD COLUMN IF NOT EXISTS provider_error TEXT;

ALTER TABLE platform_user_invites
  DROP CONSTRAINT IF EXISTS platform_user_invites_email_status_check;

ALTER TABLE platform_user_invites
  ADD CONSTRAINT platform_user_invites_email_status_check
  CHECK (email_status IN ('PENDING', 'SENT', 'FAILED'));

CREATE INDEX IF NOT EXISTS idx_platform_user_invites_email_status
  ON platform_user_invites(email_status, created_at DESC);

COMMENT ON COLUMN platform_user_invites.email_status IS
  'Invitation email delivery state: PENDING, SENT, or FAILED.';
COMMENT ON COLUMN platform_user_invites.sent_at IS
  'Timestamp when Resend accepted the invitation email.';
COMMENT ON COLUMN platform_user_invites.provider_message_id IS
  'Resend provider message ID.';
COMMENT ON COLUMN platform_user_invites.provider_error IS
  'Last safe provider error; a failed email never cancels the invitation.';


-- ─── 090_external_auth_migration.sql ───
-- =============================================================================
-- 090 — Move customer identity ownership to auth.truegoshengh.com
-- =============================================================================
-- Supabase remains the application database only. Browser clients no longer
-- authenticate to Postgres, so application tables must stop depending on
-- auth.users and stop gating rows on auth.uid().
--
-- Safe to re-run: every statement is idempotent.
--
-- Scope rule: this migration only ever touches objects in schemas that the
-- current role owns. Supabase-managed schemas (auth, storage, realtime, vault,
-- …) are owned by service roles such as supabase_auth_admin, and altering them
-- from the SQL Editor fails with `42501: must be owner of table …`. Objects the
-- current role does not own are filtered out of the catalog queries below
-- rather than being attempted and swallowed.
--
-- Deliberately NOT done here: dropping the legacy `on_auth_customer_created`
-- trigger on auth.users (migrations 010 / 018 / 044). That is inside the
-- managed auth schema and cannot be altered by this role. It is inert once the
-- external provider owns signups; remove it from the Supabase dashboard if the
-- project no longer creates Supabase Auth users at all.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- External subject mapping
-- ---------------------------------------------------------------------------

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS external_auth_id TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_profiles_external_auth_id
  ON public.profiles (external_auth_id)
  WHERE external_auth_id IS NOT NULL;

COMMENT ON COLUMN public.profiles.external_auth_id IS
  'Immutable subject from auth.truegoshengh.com; mapped to the internal customer UUID.';

-- ---------------------------------------------------------------------------
-- Drop foreign keys FROM application tables TO auth.users
-- ---------------------------------------------------------------------------
-- Customer UUIDs stay stable and are mapped to the external provider subject
-- through profiles.external_auth_id, so the FK is no longer needed.

DO $$
DECLARE
  fk RECORD;
  auth_users_oid OID := to_regclass('auth.users')::oid;
BEGIN
  IF auth_users_oid IS NULL THEN
    RAISE NOTICE 'auth.users does not exist; no foreign keys to drop.';
    RETURN;
  END IF;

  FOR fk IN
    SELECT
      n.nspname AS schema_name,
      c.relname AS table_name,
      con.conname AS constraint_name
    FROM pg_constraint con
    JOIN pg_class c ON c.oid = con.conrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE con.contype = 'f'
      AND con.confrelid = auth_users_oid
      -- Never touch Supabase-managed schemas.
      AND n.nspname NOT IN (
        'auth', 'storage', 'realtime', 'vault', 'extensions',
        'graphql', 'graphql_public', 'pgbouncer', 'supabase_migrations',
        'cron', 'net', 'pgsodium', 'pgsodium_masks', 'information_schema'
      )
      AND n.nspname NOT LIKE 'pg\_%'
      -- ALTER TABLE requires ownership; skip anything this role does not own.
      AND pg_has_role(current_user, c.relowner, 'USAGE')
  LOOP
    EXECUTE format(
      'ALTER TABLE %I.%I DROP CONSTRAINT IF EXISTS %I',
      fk.schema_name,
      fk.table_name,
      fk.constraint_name
    );
  END LOOP;
END
$$;

-- ---------------------------------------------------------------------------
-- Retire auth.uid()-based RLS policies on application tables
-- ---------------------------------------------------------------------------
-- auth.uid() is always NULL now that customers hold an external session, so
-- these policies would silently deny everything. Customer access goes through
-- server routes that verify the external session and use the service role.
-- Any table left without a policy gets the deny-by-default policy used
-- elsewhere in this schema, and keeps RLS enabled, so anon/authenticated can
-- never read customer rows directly.

DO $$
DECLARE
  policy_row RECORD;
  target RECORD;
  touched OID[] := '{}';
BEGIN
  FOR policy_row IN
    SELECT
      n.nspname AS schema_name,
      c.relname AS table_name,
      pol.polname AS policy_name,
      c.oid AS table_oid
    FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE (
        COALESCE(pg_get_expr(pol.polqual, pol.polrelid), '') ILIKE '%auth.uid()%'
        OR COALESCE(pg_get_expr(pol.polwithcheck, pol.polrelid), '') ILIKE '%auth.uid()%'
      )
      -- Never touch Supabase-managed schemas.
      AND n.nspname NOT IN (
        'auth', 'storage', 'realtime', 'vault', 'extensions',
        'graphql', 'graphql_public', 'pgbouncer', 'supabase_migrations',
        'cron', 'net', 'pgsodium', 'pgsodium_masks', 'information_schema'
      )
      AND n.nspname NOT LIKE 'pg\_%'
      -- DROP POLICY requires table ownership; skip anything this role does not own.
      AND pg_has_role(current_user, c.relowner, 'USAGE')
  LOOP
    EXECUTE format(
      'DROP POLICY IF EXISTS %I ON %I.%I',
      policy_row.policy_name,
      policy_row.schema_name,
      policy_row.table_name
    );

    IF NOT (policy_row.table_oid = ANY (touched)) THEN
      touched := touched || policy_row.table_oid;
    END IF;
  END LOOP;

  FOR target IN
    SELECT
      n.nspname AS schema_name,
      c.relname AS table_name,
      c.oid AS table_oid,
      c.relrowsecurity AS rls_enabled
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE c.oid = ANY (touched)
  LOOP
    IF NOT target.rls_enabled THEN
      EXECUTE format(
        'ALTER TABLE %I.%I ENABLE ROW LEVEL SECURITY',
        target.schema_name,
        target.table_name
      );
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polrelid = target.table_oid) THEN
      EXECUTE format(
        'CREATE POLICY %I ON %I.%I FOR ALL USING (false) WITH CHECK (false)',
        format('Service role manages %s', target.table_name),
        target.schema_name,
        target.table_name
      );
    END IF;
  END LOOP;
END
$$;

-- Reload PostgREST schema cache so external_auth_id is visible immediately.
NOTIFY pgrst, 'reload schema';


-- ─── 091_customer_profile_enrichment.sql ───
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


-- ─── 092_security_hardening.sql ───
-- =============================================================================
-- 092 — Security hardening
-- =============================================================================
-- 1) Deny client-side writes to customer-avatars (service role bypasses RLS)
-- 2) credentials_revoked_at for bearer invalidation after global session revoke
-- 3) Shared rate-limit counters for serverless auth endpoints
-- =============================================================================

-- Avatar bucket: remove overly permissive write policies from 091 if present.
DROP POLICY IF EXISTS "Service role upload customer avatars" ON storage.objects;
DROP POLICY IF EXISTS "Service role update customer avatars" ON storage.objects;
DROP POLICY IF EXISTS "Service role delete customer avatars" ON storage.objects;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS credentials_revoked_at TIMESTAMPTZ;

COMMENT ON COLUMN public.profiles.credentials_revoked_at IS
  'When set, bearer access tokens with JWT iat earlier than this timestamp are rejected.';

CREATE TABLE IF NOT EXISTS public.platform_rate_limits (
  key TEXT PRIMARY KEY,
  count INTEGER NOT NULL DEFAULT 0,
  reset_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_platform_rate_limits_reset
  ON public.platform_rate_limits (reset_at);

ALTER TABLE public.platform_rate_limits ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "No public access platform_rate_limits" ON public.platform_rate_limits;
CREATE POLICY "No public access platform_rate_limits"
  ON public.platform_rate_limits FOR ALL USING (false) WITH CHECK (false);

-- ─── 093_audit_logs.sql ───
-- =============================================================================
-- 093 — Immutable audit_logs (security / ops trail)
-- =============================================================================
-- DO NOT apply remotely from CI/agent — run in the Supabase SQL Editor after review.
--
-- Design:
--   - INSERT-only for the application (service role bypasses RLS).
--   - No UPDATE / DELETE policies for authenticated or anon roles.
--   - SELECT is denied at RLS; the platform API reads via service role and
--     gates access in application code (owner + super_admin only).
--   - Retention purge must run as a scheduled job / SQL Editor with service
--     role (or postgres) — there is intentionally no casual admin API delete.
--
-- Reversal:
--   DROP FUNCTION IF EXISTS public.purge_audit_logs_older_than_retention();
--   DROP TABLE IF EXISTS public.audit_logs;
--   DELETE FROM public.site_settings
--     WHERE key IN ('audit_log_retention_days', 'audit_log_enabled');
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  actor_user_id TEXT,
  actor_name TEXT,
  actor_role TEXT,
  action TEXT NOT NULL,
  target_type TEXT,
  target_id TEXT,
  target_name TEXT,
  ip_address TEXT,
  user_agent TEXT,
  browser TEXT,
  operating_system TEXT,
  request_id TEXT,
  success BOOLEAN NOT NULL DEFAULT true,
  error_message TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  -- Approximate geo from edge headers (e.g. Cloudflare cf-ipcountry); never blocking.
  country TEXT,
  region TEXT,
  city TEXT
);

COMMENT ON TABLE public.audit_logs IS
  'Immutable security/ops audit trail. Application writes via service role only.';

CREATE INDEX IF NOT EXISTS idx_audit_logs_timestamp
  ON public.audit_logs (timestamp DESC);

CREATE INDEX IF NOT EXISTS idx_audit_logs_actor_user_id
  ON public.audit_logs (actor_user_id)
  WHERE actor_user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_audit_logs_action
  ON public.audit_logs (action);

CREATE INDEX IF NOT EXISTS idx_audit_logs_success
  ON public.audit_logs (success);

CREATE INDEX IF NOT EXISTS idx_audit_logs_target
  ON public.audit_logs (target_type, target_id)
  WHERE target_type IS NOT NULL;

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Deny all client access. Service role bypasses RLS for INSERT/SELECT.
DROP POLICY IF EXISTS "No client access audit_logs" ON public.audit_logs;
CREATE POLICY "No client access audit_logs"
  ON public.audit_logs
  FOR ALL
  USING (false)
  WITH CHECK (false);

-- Explicit revoke of DML from common roles (defense in depth; service_role still bypasses).
REVOKE UPDATE, DELETE ON public.audit_logs FROM PUBLIC;
REVOKE UPDATE, DELETE ON public.audit_logs FROM anon, authenticated;

-- Retention defaults in site_settings (application also ships code defaults).
INSERT INTO public.site_settings (key, value)
VALUES
  ('audit_log_retention_days', '365'),
  ('audit_log_enabled', 'true')
ON CONFLICT (key) DO NOTHING;

-- Retention purge (manual / pg_cron). Safe delete only via this path.
-- Example (pg_cron, weekly):
--   SELECT cron.schedule(
--     'purge-audit-logs',
--     '0 4 * * 0',
--     'SELECT public.purge_audit_logs_older_than_retention()'
--   );
-- Manual:
--   SELECT public.purge_audit_logs_older_than_retention();
CREATE OR REPLACE FUNCTION public.purge_audit_logs_older_than_retention()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $purge$
DECLARE
  days INTEGER;
  deleted INTEGER;
BEGIN
  SELECT COALESCE(NULLIF(trim(value), '')::INTEGER, 365)
    INTO days
  FROM public.site_settings
  WHERE key = 'audit_log_retention_days';

  IF days IS NULL OR days < 1 THEN
    days := 365;
  END IF;

  -- Cap at a sane minimum so a mis-set "0" cannot wipe the table.
  IF days < 30 THEN
    days := 30;
  END IF;

  DELETE FROM public.audit_logs
  WHERE timestamp < NOW() - make_interval(days => days);

  GET DIAGNOSTICS deleted = ROW_COUNT;
  RETURN deleted;
END;
$purge$;

COMMENT ON FUNCTION public.purge_audit_logs_older_than_retention() IS
  'Deletes audit_logs older than site_settings.audit_log_retention_days (min 30, default 365). Run via cron/service role only.';

REVOKE ALL ON FUNCTION public.purge_audit_logs_older_than_retention() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.purge_audit_logs_older_than_retention() TO service_role;


-- ─── 094_platform_password_reset_tokens.sql ───
-- =============================================================================
-- 094 — Platform staff self-serve password reset tokens
-- =============================================================================
-- DO NOT apply remotely from CI/agent — run in the Supabase SQL Editor after review.
--
-- Design:
--   - One-time hashed tokens (SHA-256 of random secret).
--   - Short TTL enforced in application code (1 hour).
--   - Service role only; RLS denies all public access.
--
-- Reversal:
--   DROP TABLE IF EXISTS public.platform_password_reset_tokens;
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.platform_password_reset_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.platform_users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  requested_ip TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_platform_password_reset_tokens_user_unused
  ON public.platform_password_reset_tokens(user_id)
  WHERE used_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_platform_password_reset_tokens_expires
  ON public.platform_password_reset_tokens(expires_at);

ALTER TABLE public.platform_password_reset_tokens ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "No public access to platform password reset tokens"
  ON public.platform_password_reset_tokens;
CREATE POLICY "No public access to platform password reset tokens"
  ON public.platform_password_reset_tokens
  FOR ALL
  USING (false)
  WITH CHECK (false);

-- ─── 095_ai_usage_logs.sql ───
-- =============================================================================
-- 095 - Inventory AI usage history (Gemini chat, vision, image edits, stock photos)
-- =============================================================================
-- DO NOT apply remotely from CI/agent - run in the Supabase SQL Editor after review.
--
-- Design:
--   - Application reads/writes via service role (RLS denies clients).
--   - Soft-delete via deleted_at (staff/managers can discard from default views).
--   - Permanent purge is gated in the platform API (owner / super_admin / administrator).
--
-- Reversal:
--   DROP TABLE IF EXISTS public.ai_usage_logs;
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.ai_usage_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ,
  actor_user_id TEXT,
  actor_name TEXT,
  actor_email TEXT,
  actor_role TEXT,
  action TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'success'
    CHECK (status IN ('success', 'error', 'partial')),
  vehicle_id TEXT,
  vehicle_slug TEXT,
  vehicle_label TEXT,
  preview_snippet TEXT,
  error_message TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb
);

COMMENT ON TABLE public.ai_usage_logs IS
  'Inventory AI usage history (chat, vision, image adjust, stock photos). Soft-deletable; permanent purge via service role API.';

CREATE INDEX IF NOT EXISTS idx_ai_usage_logs_created_at
  ON public.ai_usage_logs (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_ai_usage_logs_vehicle_id
  ON public.ai_usage_logs (vehicle_id)
  WHERE vehicle_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_ai_usage_logs_action
  ON public.ai_usage_logs (action);

CREATE INDEX IF NOT EXISTS idx_ai_usage_logs_deleted_at
  ON public.ai_usage_logs (deleted_at)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_ai_usage_logs_actor_user_id
  ON public.ai_usage_logs (actor_user_id)
  WHERE actor_user_id IS NOT NULL;

ALTER TABLE public.ai_usage_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "No client access ai_usage_logs" ON public.ai_usage_logs;
CREATE POLICY "No client access ai_usage_logs"
  ON public.ai_usage_logs
  FOR ALL
  USING (false)
  WITH CHECK (false);

-- ─── 096_vehicles_public_hide_trashed.sql ───
-- Soft-deleted / trashed vehicles must never be readable by the anon key.
-- App queries already filter deleted_at, but RLS is the authoritative public gate.
-- Soft-delete leaves status as available/pre_order, so the prior policy still matched.

DROP POLICY IF EXISTS "Vehicles are publicly readable" ON vehicles;
CREATE POLICY "Vehicles are publicly readable"
  ON vehicles FOR SELECT
  USING (
    deleted_at IS NULL
    AND status IN ('available', 'pre_order')
    AND (
      approval_status = 'approved'
      OR (
        approval_status IN ('pending_approval', 'rejected')
        AND pending_changes IS NOT NULL
      )
    )
  );


-- ─── 097_platform_must_change_password.sql ───
-- Require platform team members to replace admin-assigned temporary passwords
-- before accessing the admin console.

ALTER TABLE platform_users
  ADD COLUMN IF NOT EXISTS must_change_password BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN platform_users.must_change_password IS
  'When true, the user must change their password before accessing platform routes. Set when an owner/admin assigns a temporary password.';

CREATE INDEX IF NOT EXISTS idx_platform_users_must_change_password
  ON platform_users (must_change_password)
  WHERE must_change_password = true;

-- ─── 098_staff_whatsapp_messages.sql ───
-- =============================================================================
-- 098 - Staff WhatsApp assist conversation history (outbound staff sends)
-- =============================================================================
-- DO NOT apply remotely from CI/agent - run in the Supabase SQL Editor after review.
--
-- Stores messages staff send via Platform → WhatsApp Assist (API or wa.me fallback).
-- Used for follow-up context in AI suggestions; not a full WhatsApp Business inbox.
--
-- Reversal:
--   DROP TABLE IF EXISTS public.staff_whatsapp_messages;
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.staff_whatsapp_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  customer_user_id TEXT,
  customer_email TEXT,
  customer_phone TEXT NOT NULL,
  direction TEXT NOT NULL DEFAULT 'outbound'
    CHECK (direction IN ('outbound')),
  body TEXT NOT NULL,
  staff_user_id TEXT,
  staff_is_owner BOOLEAN NOT NULL DEFAULT false,
  staff_name TEXT,
  context_type TEXT,
  context_id TEXT,
  send_method TEXT
    CHECK (send_method IS NULL OR send_method IN ('api', 'wa_me')),
  provider_message_id TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb
);

COMMENT ON TABLE public.staff_whatsapp_messages IS
  'Outbound WhatsApp messages sent by platform staff via WhatsApp Assist (reviewed before send).';

CREATE INDEX IF NOT EXISTS idx_staff_whatsapp_messages_phone_created
  ON public.staff_whatsapp_messages (customer_phone, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_staff_whatsapp_messages_user_created
  ON public.staff_whatsapp_messages (customer_user_id, created_at DESC)
  WHERE customer_user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_staff_whatsapp_messages_email_created
  ON public.staff_whatsapp_messages (customer_email, created_at DESC)
  WHERE customer_email IS NOT NULL;

ALTER TABLE public.staff_whatsapp_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "No client access staff_whatsapp_messages" ON public.staff_whatsapp_messages;
CREATE POLICY "No client access staff_whatsapp_messages"
  ON public.staff_whatsapp_messages
  FOR ALL
  USING (false)
  WITH CHECK (false);


-- ─── 099_exchange_rate_snapshots.sql ───
-- =============================================================================
-- 099 — Exchange rate last-good cache + immutable FX snapshots
-- =============================================================================
-- DO NOT apply remotely from CI/agent — run in the Supabase SQL Editor after review.
--
-- Purpose:
--   1. Persist the last successful USD-base mid-market feed so cold starts do
--      not fall back to ancient NEXT_PUBLIC_USD_TO_* env defaults.
--   2. Freeze the rate used on quotations, invoices, orders, payments, sales,
--      pre-orders, and expenses. Past documents MUST NOT change when today's
--      market rate moves.
--
-- Manual per-document overrides live on exchange_rate_snapshots (is_manual).
-- They never rewrite the live market feed.
--
-- Reversal:
--   DROP TABLE IF EXISTS public.exchange_rate_snapshots;
--   DROP TABLE IF EXISTS public.exchange_rate_cache;
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.exchange_rate_cache (
  id TEXT PRIMARY KEY DEFAULT 'usd',
  rates JSONB NOT NULL,
  rates_from_ghs JSONB,
  source TEXT NOT NULL,
  provider TEXT NOT NULL DEFAULT 'exchangerate-api',
  stale BOOLEAN NOT NULL DEFAULT false,
  fetched_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  rate_date TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.exchange_rate_cache IS
  'Last successful USD-base mid-market rates. Used when the live provider is down. Not a substitute for document snapshots.';

ALTER TABLE public.exchange_rate_cache ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "No client access exchange_rate_cache" ON public.exchange_rate_cache;
CREATE POLICY "No client access exchange_rate_cache"
  ON public.exchange_rate_cache
  FOR ALL
  USING (false)
  WITH CHECK (false);

REVOKE ALL ON public.exchange_rate_cache FROM PUBLIC;
REVOKE ALL ON public.exchange_rate_cache FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON public.exchange_rate_cache TO service_role;

CREATE TABLE IF NOT EXISTS public.exchange_rate_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type TEXT NOT NULL,
  entity_id UUID NOT NULL,
  source_currency TEXT NOT NULL DEFAULT 'USD',
  target_currency TEXT NOT NULL DEFAULT 'GHS',
  original_amount NUMERIC(18, 4) NOT NULL,
  rate_used NUMERIC(18, 8) NOT NULL,
  converted_amount NUMERIC(18, 4) NOT NULL,
  retrieved_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  provider TEXT NOT NULL DEFAULT 'exchangerate-api',
  source TEXT NOT NULL DEFAULT 'exchangerate-api',
  rate_date TEXT,
  rates_json JSONB,
  is_manual BOOLEAN NOT NULL DEFAULT false,
  previous_live_rate NUMERIC(18, 8),
  override_reason TEXT,
  override_actor_id TEXT,
  override_actor_name TEXT,
  override_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT exchange_rate_snapshots_entity_unique
    UNIQUE (entity_type, entity_id, source_currency, target_currency),
  CONSTRAINT exchange_rate_snapshots_codes_chk
    CHECK (
      char_length(source_currency) = 3
      AND char_length(target_currency) = 3
    ),
  CONSTRAINT exchange_rate_snapshots_rate_chk
    CHECK (rate_used > 0),
  CONSTRAINT exchange_rate_snapshots_entity_type_chk
    CHECK (
      entity_type IN (
        'sale',
        'parts_order',
        'preorder',
        'expense',
        'quotation',
        'invoice',
        'payment'
      )
    )
);

COMMENT ON TABLE public.exchange_rate_snapshots IS
  'Immutable FX conversion used on a financial record. Updates are limited to owner/super_admin manual overrides (labelled, audited). Live market changes must not rewrite these rows.';

COMMENT ON COLUMN public.exchange_rate_snapshots.rate_used IS
  'Units of target_currency per 1 unit of source_currency at retrieved_at.';

COMMENT ON COLUMN public.exchange_rate_snapshots.rates_json IS
  'Optional full USD-base rate map at snapshot time so reprints in any currency stay frozen.';

COMMENT ON COLUMN public.exchange_rate_snapshots.is_manual IS
  'True when an owner/super_admin overrode the live mid-market rate for this document only.';

CREATE INDEX IF NOT EXISTS idx_exchange_rate_snapshots_entity
  ON public.exchange_rate_snapshots (entity_type, entity_id);

CREATE INDEX IF NOT EXISTS idx_exchange_rate_snapshots_retrieved
  ON public.exchange_rate_snapshots (retrieved_at DESC);

ALTER TABLE public.exchange_rate_snapshots ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "No client access exchange_rate_snapshots" ON public.exchange_rate_snapshots;
CREATE POLICY "No client access exchange_rate_snapshots"
  ON public.exchange_rate_snapshots
  FOR ALL
  USING (false)
  WITH CHECK (false);

REVOKE ALL ON public.exchange_rate_snapshots FROM PUBLIC;
REVOKE ALL ON public.exchange_rate_snapshots FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON public.exchange_rate_snapshots TO service_role;

DROP TRIGGER IF EXISTS exchange_rate_snapshots_updated_at ON public.exchange_rate_snapshots;
CREATE TRIGGER exchange_rate_snapshots_updated_at
  BEFORE UPDATE ON public.exchange_rate_snapshots
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();


-- ─── 100_extended_trash_soft_delete.sql ───
- -   S o f t - d e l e t e   c o l u m n s   f o r   e n t i t i e s   t h a t   p r e v i o u s l y   h a r d - d e l e t e d   o n   a d m i n   d e l e t e . 
 
 A L T E R   T A B L E   d o c u m e n t s 
     A D D   C O L U M N   I F   N O T   E X I S T S   d e l e t e d _ a t   T I M E S T A M P T Z , 
     A D D   C O L U M N   I F   N O T   E X I S T S   d e l e t e d _ b y _ u s e r _ i d   U U I D   R E F E R E N C E S   p l a t f o r m _ u s e r s ( i d )   O N   D E L E T E   S E T   N U L L ; 
 
 A L T E R   T A B L E   p a r t s 
     A D D   C O L U M N   I F   N O T   E X I S T S   d e l e t e d _ a t   T I M E S T A M P T Z , 
     A D D   C O L U M N   I F   N O T   E X I S T S   d e l e t e d _ b y _ u s e r _ i d   U U I D   R E F E R E N C E S   p l a t f o r m _ u s e r s ( i d )   O N   D E L E T E   S E T   N U L L ; 
 
 A L T E R   T A B L E   p a r t s _ c a t e g o r i e s 
     A D D   C O L U M N   I F   N O T   E X I S T S   d e l e t e d _ a t   T I M E S T A M P T Z , 
     A D D   C O L U M N   I F   N O T   E X I S T S   d e l e t e d _ b y _ u s e r _ i d   U U I D   R E F E R E N C E S   p l a t f o r m _ u s e r s ( i d )   O N   D E L E T E   S E T   N U L L ; 
 
 A L T E R   T A B L E   s h i p m e n t _ t r a c k i n g 
     A D D   C O L U M N   I F   N O T   E X I S T S   d e l e t e d _ a t   T I M E S T A M P T Z , 
     A D D   C O L U M N   I F   N O T   E X I S T S   d e l e t e d _ b y _ u s e r _ i d   U U I D   R E F E R E N C E S   p l a t f o r m _ u s e r s ( i d )   O N   D E L E T E   S E T   N U L L ; 
 
 A L T E R   T A B L E   f r e i g h t _ q u o t e _ r e q u e s t s 
     A D D   C O L U M N   I F   N O T   E X I S T S   d e l e t e d _ a t   T I M E S T A M P T Z , 
     A D D   C O L U M N   I F   N O T   E X I S T S   d e l e t e d _ b y _ u s e r _ i d   U U I D   R E F E R E N C E S   p l a t f o r m _ u s e r s ( i d )   O N   D E L E T E   S E T   N U L L ; 
 
 A L T E R   T A B L E   v e h i c l e _ a p p o i n t m e n t s 
     A D D   C O L U M N   I F   N O T   E X I S T S   d e l e t e d _ a t   T I M E S T A M P T Z , 
     A D D   C O L U M N   I F   N O T   E X I S T S   d e l e t e d _ b y _ u s e r _ i d   U U I D   R E F E R E N C E S   p l a t f o r m _ u s e r s ( i d )   O N   D E L E T E   S E T   N U L L ; 
 
 C R E A T E   I N D E X   I F   N O T   E X I S T S   i d x _ d o c u m e n t s _ d e l e t e d _ a t   O N   d o c u m e n t s   ( d e l e t e d _ a t ) 
     W H E R E   d e l e t e d _ a t   I S   N O T   N U L L ; 
 
 C R E A T E   I N D E X   I F   N O T   E X I S T S   i d x _ p a r t s _ d e l e t e d _ a t   O N   p a r t s   ( d e l e t e d _ a t ) 
     W H E R E   d e l e t e d _ a t   I S   N O T   N U L L ; 
 
 C R E A T E   I N D E X   I F   N O T   E X I S T S   i d x _ p a r t s _ c a t e g o r i e s _ d e l e t e d _ a t   O N   p a r t s _ c a t e g o r i e s   ( d e l e t e d _ a t ) 
     W H E R E   d e l e t e d _ a t   I S   N O T   N U L L ; 
 
 C R E A T E   I N D E X   I F   N O T   E X I S T S   i d x _ s h i p m e n t _ t r a c k i n g _ d e l e t e d _ a t   O N   s h i p m e n t _ t r a c k i n g   ( d e l e t e d _ a t ) 
     W H E R E   d e l e t e d _ a t   I S   N O T   N U L L ; 
 
 C R E A T E   I N D E X   I F   N O T   E X I S T S   i d x _ f r e i g h t _ q u o t e _ r e q u e s t s _ d e l e t e d _ a t   O N   f r e i g h t _ q u o t e _ r e q u e s t s   ( d e l e t e d _ a t ) 
     W H E R E   d e l e t e d _ a t   I S   N O T   N U L L ; 
 
 C R E A T E   I N D E X   I F   N O T   E X I S T S   i d x _ v e h i c l e _ a p p o i n t m e n t s _ d e l e t e d _ a t   O N   v e h i c l e _ a p p o i n t m e n t s   ( d e l e t e d _ a t ) 
     W H E R E   d e l e t e d _ a t   I S   N O T   N U L L ; 
 

-- ─── 101_inquiry_notification_detail_links.sql ───
- -   R o u t e   i n q u i r y   n o t i f i c a t i o n s   t o   d e t a i l   p a g e s   a n d   s t o r e   r i c h e r   m e t a d a t a   f o r   a d m i n   U I . 
 
 C R E A T E   O R   R E P L A C E   F U N C T I O N   n o t i f y _ a d m i n _ i n q u i r y ( ) 
 R E T U R N S   T R I G G E R   A S   $ $ 
 D E C L A R E 
     v _ t y p e   T E X T ; 
     v _ t i t l e   T E X T ; 
     v _ m e s s a g e   T E X T ; 
     v _ l i n k   T E X T ; 
     v _ n a m e   T E X T ; 
     v _ m e t a d a t a   J S O N B   : =   ' { } ' : : j s o n b ; 
     v _ v e h i c l e   R E C O R D ; 
     v _ v e h i c l e _ t i t l e   T E X T ; 
     v _ i m a g e   T E X T ; 
 B E G I N 
     v _ t y p e   : =   T G _ A R G V [ 0 ] ; 
     v _ l i n k   : =   T G _ A R G V [ 1 ] ; 
 
     I F   T G _ T A B L E _ N A M E   =   ' p r e o r d e r _ i n q u i r i e s '   T H E N 
         v _ n a m e   : =   N E W . n a m e ; 
         v _ v e h i c l e   : =   N U L L ; 
 
         I F   N E W . v e h i c l e _ i d   I S   N O T   N U L L   T H E N 
             S E L E C T   i d ,   y e a r ,   m a k e ,   m o d e l ,   s l u g ,   p r i c e ,   i m a g e s ,   t r i m ,   s t a t u s 
             I N T O   v _ v e h i c l e 
             F R O M   v e h i c l e s 
             W H E R E   i d   =   N E W . v e h i c l e _ i d ; 
         E N D   I F ; 
 
         v _ v e h i c l e _ t i t l e   : =   C O A L E S C E ( 
             N E W . v e h i c l e _ t i t l e , 
             C A S E 
                 W H E N   v _ v e h i c l e . i d   I S   N O T   N U L L   T H E N 
                     v _ v e h i c l e . y e a r   | |   '   '   | |   v _ v e h i c l e . m a k e   | |   '   '   | |   v _ v e h i c l e . m o d e l 
                 E L S E   N U L L 
             E N D , 
             ' U n k n o w n   v e h i c l e ' 
         ) ; 
 
         v _ i m a g e   : =   N U L L ; 
         I F   v _ v e h i c l e . i m a g e s   I S   N O T   N U L L   A N D   a r r a y _ l e n g t h ( v _ v e h i c l e . i m a g e s ,   1 )   >   0   T H E N 
             v _ i m a g e   : =   v _ v e h i c l e . i m a g e s [ 1 ] ; 
         E N D   I F ; 
 
         v _ t i t l e   : =   ' P r e - o r d e r :   '   | |   v _ v e h i c l e _ t i t l e ; 
         v _ m e s s a g e   : =   v _ n a m e   | |   '   �   '   | |   v _ v e h i c l e _ t i t l e   | |   '   �   $ ' 
             | |   t o _ c h a r ( C O A L E S C E ( N E W . d o w n _ p a y m e n t _ u s d ,   0 ) ,   ' F M 9 9 9 , 9 9 9 ' )   | |   '   d o w n ' ; 
         v _ l i n k   : =   ' / p l a t f o r m / l e a d s / p r e o r d e r / '   | |   N E W . i d : : t e x t ; 
 
         v _ m e t a d a t a   : =   j s o n b _ b u i l d _ o b j e c t ( 
             ' c u s t o m e r ' ,   j s o n b _ b u i l d _ o b j e c t ( 
                 ' n a m e ' ,   N E W . n a m e , 
                 ' e m a i l ' ,   N E W . e m a i l , 
                 ' p h o n e ' ,   N E W . p h o n e , 
                 ' m e s s a g e ' ,   N E W . m e s s a g e 
             ) , 
             ' v e h i c l e ' ,   j s o n b _ b u i l d _ o b j e c t ( 
                 ' i d ' ,   C O A L E S C E ( N E W . v e h i c l e _ i d : : t e x t ,   v _ v e h i c l e . i d : : t e x t ) , 
                 ' y e a r ' ,   C O A L E S C E ( v _ v e h i c l e . y e a r ,   N U L L ) , 
                 ' m a k e ' ,   v _ v e h i c l e . m a k e , 
                 ' m o d e l ' ,   v _ v e h i c l e . m o d e l , 
                 ' s l u g ' ,   C O A L E S C E ( N E W . v e h i c l e _ s l u g ,   v _ v e h i c l e . s l u g ) , 
                 ' p r i c e ' ,   C O A L E S C E ( N E W . v e h i c l e _ p r i c e _ u s d ,   v _ v e h i c l e . p r i c e ) , 
                 ' i m a g e ' ,   v _ i m a g e , 
                 ' t i t l e ' ,   v _ v e h i c l e _ t i t l e , 
                 ' s t a t u s ' ,   v _ v e h i c l e . s t a t u s 
             ) , 
             ' d o w n P a y m e n t U s d ' ,   N E W . d o w n _ p a y m e n t _ u s d , 
             ' d o w n P a y m e n t F o r m a t t e d ' ,   ' $ '   | |   t o _ c h a r ( C O A L E S C E ( N E W . d o w n _ p a y m e n t _ u s d ,   0 ) ,   ' F M 9 9 9 , 9 9 9 ' ) 
         ) ; 
 
     E L S I F   T G _ T A B L E _ N A M E   =   ' v e h i c l e _ i n q u i r i e s '   T H E N 
         v _ n a m e   : =   N E W . n a m e ; 
         v _ t i t l e   : =   ' N e w   v e h i c l e   i n q u i r y ' ; 
         v _ m e s s a g e   : =   v _ n a m e   | |   '   i n q u i r e d   a b o u t   '   | |   C O A L E S C E ( N E W . v e h i c l e _ n a m e ,   N E W . v e h i c l e _ s l u g ,   ' a   v e h i c l e ' ) ; 
         v _ l i n k   : =   ' / p l a t f o r m / l e a d s / v e h i c l e / '   | |   N E W . i d : : t e x t ; 
         v _ m e t a d a t a   : =   j s o n b _ b u i l d _ o b j e c t ( 
             ' c u s t o m e r ' ,   j s o n b _ b u i l d _ o b j e c t ( 
                 ' n a m e ' ,   N E W . n a m e , 
                 ' e m a i l ' ,   N E W . e m a i l , 
                 ' p h o n e ' ,   N E W . p h o n e , 
                 ' m e s s a g e ' ,   N E W . m e s s a g e 
             ) , 
             ' v e h i c l e ' ,   j s o n b _ b u i l d _ o b j e c t ( 
                 ' n a m e ' ,   N E W . v e h i c l e _ n a m e , 
                 ' s l u g ' ,   N E W . v e h i c l e _ s l u g , 
                 ' i n q u i r y T y p e ' ,   N E W . i n q u i r y _ t y p e 
             ) 
         ) ; 
 
     E L S I F   T G _ T A B L E _ N A M E   =   ' c o n t a c t _ i n q u i r i e s '   T H E N 
         v _ n a m e   : =   N E W . n a m e ; 
         v _ t i t l e   : =   ' N e w   c o n t a c t   m e s s a g e ' ; 
         v _ m e s s a g e   : =   v _ n a m e   | |   ' :   '   | |   L E F T ( C O A L E S C E ( N E W . s u b j e c t ,   N E W . m e s s a g e ,   ' ' ) ,   1 2 0 ) ; 
         v _ l i n k   : =   ' / p l a t f o r m / l e a d s / c o n t a c t / '   | |   N E W . i d : : t e x t ; 
         v _ m e t a d a t a   : =   j s o n b _ b u i l d _ o b j e c t ( 
             ' c u s t o m e r ' ,   j s o n b _ b u i l d _ o b j e c t ( 
                 ' n a m e ' ,   N E W . n a m e , 
                 ' e m a i l ' ,   N E W . e m a i l , 
                 ' p h o n e ' ,   N E W . p h o n e 
             ) , 
             ' s u b j e c t ' ,   N E W . s u b j e c t , 
             ' m e s s a g e ' ,   N E W . m e s s a g e 
         ) ; 
 
     E L S I F   T G _ T A B L E _ N A M E   =   ' f i n a n c e _ a p p l i c a t i o n s '   T H E N 
         v _ n a m e   : =   N E W . f i r s t _ n a m e   | |   '   '   | |   N E W . l a s t _ n a m e ; 
         v _ t i t l e   : =   ' N e w   f i n a n c e   a p p l i c a t i o n ' ; 
         v _ m e s s a g e   : =   T R I M ( v _ n a m e )   | |   '   a p p l i e d   f o r   f i n a n c i n g ' 
             | |   C A S E 
                 W H E N   N E W . v e h i c l e _ o f _ i n t e r e s t   I S   N O T   N U L L   A N D   N E W . v e h i c l e _ o f _ i n t e r e s t   < >   ' ' 
                     T H E N   '   �   '   | |   N E W . v e h i c l e _ o f _ i n t e r e s t 
                 E L S E   ' ' 
             E N D ; 
         v _ l i n k   : =   ' / p l a t f o r m / l e a d s / f i n a n c e / '   | |   N E W . i d : : t e x t ; 
         v _ m e t a d a t a   : =   j s o n b _ b u i l d _ o b j e c t ( 
             ' c u s t o m e r ' ,   j s o n b _ b u i l d _ o b j e c t ( 
                 ' n a m e ' ,   T R I M ( v _ n a m e ) , 
                 ' e m a i l ' ,   N E W . e m a i l , 
                 ' p h o n e ' ,   N E W . p h o n e 
             ) , 
             ' a n n u a l I n c o m e R a n g e ' ,   N E W . a n n u a l _ i n c o m e _ r a n g e , 
             ' c r e d i t S c o r e R a n g e ' ,   N E W . c r e d i t _ s c o r e _ r a n g e , 
             ' v e h i c l e O f I n t e r e s t ' ,   N E W . v e h i c l e _ o f _ i n t e r e s t , 
             ' n o t e s ' ,   N E W . n o t e s 
         ) ; 
 
     E L S I F   T G _ T A B L E _ N A M E   =   ' a p p r a i s a l _ r e q u e s t s '   T H E N 
         v _ n a m e   : =   N E W . s e l l e r _ n a m e ; 
         v _ t i t l e   : =   ' N e w   a p p r a i s a l   r e q u e s t ' ; 
         v _ m e s s a g e   : =   v _ n a m e   | |   '   w a n t s   t o   s e l l   a   '   | |   N E W . y e a r   | |   '   '   | |   N E W . m a k e   | |   '   '   | |   N E W . m o d e l ; 
         v _ l i n k   : =   ' / p l a t f o r m / l e a d s / a p p r a i s a l / '   | |   N E W . i d : : t e x t ; 
         v _ m e t a d a t a   : =   j s o n b _ b u i l d _ o b j e c t ( 
             ' c u s t o m e r ' ,   j s o n b _ b u i l d _ o b j e c t ( 
                 ' n a m e ' ,   N E W . s e l l e r _ n a m e , 
                 ' p h o n e ' ,   N E W . s e l l e r _ p h o n e 
             ) , 
             ' y e a r ' ,   N E W . y e a r , 
             ' m a k e ' ,   N E W . m a k e , 
             ' m o d e l ' ,   N E W . m o d e l , 
             ' m i l e a g e ' ,   N E W . m i l e a g e , 
             ' c o n d i t i o n ' ,   N E W . c o n d i t i o n , 
             ' n o t e s ' ,   N E W . n o t e s 
         ) ; 
 
     E L S E 
         R E T U R N   N E W ; 
     E N D   I F ; 
 
     I N S E R T   I N T O   a d m i n _ n o t i f i c a t i o n s   ( t y p e ,   t i t l e ,   m e s s a g e ,   l i n k ,   s o u r c e _ t a b l e ,   s o u r c e _ i d ,   m e t a d a t a ) 
     V A L U E S   ( v _ t y p e ,   v _ t i t l e ,   v _ m e s s a g e ,   v _ l i n k ,   T G _ T A B L E _ N A M E ,   N E W . i d ,   v _ m e t a d a t a ) 
     O N   C O N F L I C T   ( s o u r c e _ t a b l e ,   s o u r c e _ i d )   W H E R E   s o u r c e _ i d   I S   N O T   N U L L   D O   N O T H I N G ; 
 
     R E T U R N   N E W ; 
 E N D ; 
 $ $   L A N G U A G E   p l p g s q l ; 
 
 - -   B a c k f i l l   d e t a i l   l i n k s   f o r   e x i s t i n g   i n q u i r y   n o t i f i c a t i o n s . 
 U P D A T E   a d m i n _ n o t i f i c a t i o n s 
 S E T   l i n k   =   ' / p l a t f o r m / l e a d s / v e h i c l e / '   | |   s o u r c e _ i d : : t e x t 
 W H E R E   s o u r c e _ t a b l e   =   ' v e h i c l e _ i n q u i r i e s ' 
     A N D   s o u r c e _ i d   I S   N O T   N U L L 
     A N D   ( l i n k   I S   N U L L   O R   l i n k   L I K E   ' % ? t a b = v e h i c l e % ' ) ; 
 
 U P D A T E   a d m i n _ n o t i f i c a t i o n s 
 S E T   l i n k   =   ' / p l a t f o r m / l e a d s / c o n t a c t / '   | |   s o u r c e _ i d : : t e x t 
 W H E R E   s o u r c e _ t a b l e   =   ' c o n t a c t _ i n q u i r i e s ' 
     A N D   s o u r c e _ i d   I S   N O T   N U L L 
     A N D   ( l i n k   I S   N U L L   O R   l i n k   L I K E   ' % ? t a b = c o n t a c t % ' ) ; 
 
 U P D A T E   a d m i n _ n o t i f i c a t i o n s 
 S E T   l i n k   =   ' / p l a t f o r m / l e a d s / f i n a n c e / '   | |   s o u r c e _ i d : : t e x t 
 W H E R E   s o u r c e _ t a b l e   =   ' f i n a n c e _ a p p l i c a t i o n s ' 
     A N D   s o u r c e _ i d   I S   N O T   N U L L 
     A N D   ( l i n k   I S   N U L L   O R   l i n k   L I K E   ' % ? t a b = f i n a n c e % ' ) ; 
 
 U P D A T E   a d m i n _ n o t i f i c a t i o n s 
 S E T   l i n k   =   ' / p l a t f o r m / l e a d s / a p p r a i s a l / '   | |   s o u r c e _ i d : : t e x t 
 W H E R E   s o u r c e _ t a b l e   =   ' a p p r a i s a l _ r e q u e s t s ' 
     A N D   s o u r c e _ i d   I S   N O T   N U L L 
     A N D   ( l i n k   I S   N U L L   O R   l i n k   L I K E   ' % ? t a b = a p p r a i s a l % ' ) ; 
 

-- ─── 102_customer_reauth_codes.sql ───
﻿-- =============================================================================
-- 102 - Customer re-authentication codes (6-digit OTP)
-- =============================================================================
-- DO NOT apply remotely from CI/agent - run in the Supabase SQL Editor after review.
--
-- Required before account deletion email codes work in production.
--
-- Reversal:
--   DROP TABLE IF EXISTS public.customer_reauth_codes;
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.customer_reauth_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  purpose TEXT NOT NULL,
  code_hash TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  requested_ip TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_customer_reauth_codes_user_purpose_unused
  ON public.customer_reauth_codes (user_id, purpose, created_at DESC)
  WHERE used_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_customer_reauth_codes_expires
  ON public.customer_reauth_codes (expires_at);

ALTER TABLE public.customer_reauth_codes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "No public access to customer reauth codes"
  ON public.customer_reauth_codes;
CREATE POLICY "No public access to customer reauth codes"
  ON public.customer_reauth_codes
  FOR ALL
  USING (false)
  WITH CHECK (false);

COMMENT ON TABLE public.customer_reauth_codes IS
  'Hashed one-time 6-digit codes for customer re-authentication (deletion, restore).';

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.customer_reauth_codes TO service_role;

NOTIFY pgrst, 'reload schema';


-- ─── 103_customer_reauth_codes_grants.sql ───
-- =============================================================================
-- 103 - Customer reauth codes: service_role grants + PostgREST schema reload
-- =============================================================================
-- DO NOT apply remotely from CI/agent - run in the Supabase SQL Editor after review.
--
-- Required when 102_customer_reauth_codes.sql was applied but:
--   - PostgREST still returns "Could not find the table ... in the schema cache"
--   - or the service role lacks table privileges
--
-- Safe to re-run.
-- =============================================================================

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.customer_reauth_codes TO service_role;

NOTIFY pgrst, 'reload schema';
