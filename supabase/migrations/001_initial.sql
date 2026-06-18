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
