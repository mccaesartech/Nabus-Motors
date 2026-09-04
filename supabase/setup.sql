-- Nabus Motors — database setup (Step 1 of 2)
-- Run this ONCE in Supabase Dashboard → SQL Editor → New query → Run
-- THEN run supabase/seed-vehicles.sql (Step 2)

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ─── Profiles ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  first_name TEXT,
  last_name TEXT,
  phone TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─── Vehicles ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS vehicles (
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
  gallery JSONB DEFAULT '{"exterior":[],"interior":[],"engine":[],"other":[]}'::jsonb,
  specs JSONB DEFAULT '[]',
  history JSONB DEFAULT '[]',
  status TEXT DEFAULT 'available',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─── Saved vehicles ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS saved_vehicles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  vehicle_id UUID NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
  saved_price INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, vehicle_id)
);

-- ─── Finance applications ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS finance_applications (
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

-- ─── Contact inquiries ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS contact_inquiries (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  subject TEXT,
  message TEXT NOT NULL,
  status TEXT DEFAULT 'new',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─── Sell / trade appraisals ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS appraisal_requests (
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

-- ─── Newsletter ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS newsletter_subscribers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email TEXT UNIQUE NOT NULL,
  subscribed_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─── Vehicle inquiries (purchase / test drive / rental) ─────────────────────
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

-- ─── Indexes ────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_vehicles_make ON vehicles(make);
CREATE INDEX IF NOT EXISTS idx_vehicles_body_type ON vehicles(body_type);
CREATE INDEX IF NOT EXISTS idx_vehicles_price ON vehicles(price);
CREATE INDEX IF NOT EXISTS idx_vehicles_featured ON vehicles(featured);
CREATE INDEX IF NOT EXISTS idx_vehicles_status ON vehicles(status);
CREATE INDEX IF NOT EXISTS idx_saved_vehicles_user ON saved_vehicles(user_id);
CREATE INDEX IF NOT EXISTS idx_vehicle_inquiries_status ON vehicle_inquiries(status);
CREATE INDEX IF NOT EXISTS idx_contact_inquiries_status ON contact_inquiries(status);

-- ─── Row Level Security ───────────────────────────────────────────────────────
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE vehicles ENABLE ROW LEVEL SECURITY;
ALTER TABLE saved_vehicles ENABLE ROW LEVEL SECURITY;
ALTER TABLE finance_applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE contact_inquiries ENABLE ROW LEVEL SECURITY;
ALTER TABLE appraisal_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE newsletter_subscribers ENABLE ROW LEVEL SECURITY;
ALTER TABLE vehicle_inquiries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public profiles are viewable by owner" ON profiles;
CREATE POLICY "Public profiles are viewable by owner"
  ON profiles FOR SELECT USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can view own saved vehicles" ON saved_vehicles;
CREATE POLICY "Users can view own saved vehicles"
  ON saved_vehicles FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can manage own saved vehicles" ON saved_vehicles;
CREATE POLICY "Users can manage own saved vehicles"
  ON saved_vehicles FOR ALL USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Anyone can submit finance applications" ON finance_applications;
CREATE POLICY "Anyone can submit finance applications"
  ON finance_applications FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Users can view own finance applications" ON finance_applications;
CREATE POLICY "Users can view own finance applications"
  ON finance_applications FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Vehicles are publicly readable" ON vehicles;
CREATE POLICY "Vehicles are publicly readable"
  ON vehicles FOR SELECT USING (status = 'available');

DROP POLICY IF EXISTS "Anyone can submit contact inquiries" ON contact_inquiries;
CREATE POLICY "Anyone can submit contact inquiries"
  ON contact_inquiries FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Anyone can submit appraisal requests" ON appraisal_requests;
CREATE POLICY "Anyone can submit appraisal requests"
  ON appraisal_requests FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Anyone can subscribe to newsletter" ON newsletter_subscribers;
CREATE POLICY "Anyone can subscribe to newsletter"
  ON newsletter_subscribers FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Anyone can submit vehicle inquiries" ON vehicle_inquiries;
CREATE POLICY "Anyone can submit vehicle inquiries"
  ON vehicle_inquiries FOR INSERT WITH CHECK (true);

-- ─── Updated_at trigger ─────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS vehicles_updated_at ON vehicles;
CREATE TRIGGER vehicles_updated_at
  BEFORE UPDATE ON vehicles
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Categorized photo galleries (also in migrations/012_vehicle_image_categories.sql)
ALTER TABLE vehicles
  ADD COLUMN IF NOT EXISTS gallery JSONB
  DEFAULT '{"exterior":[],"interior":[],"engine":[],"other":[]}'::jsonb;
