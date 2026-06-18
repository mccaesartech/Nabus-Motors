-- Run this entire file in Supabase Dashboard → SQL Editor
-- https://supabase.com/dashboard → your project → SQL Editor → New query

-- Schema (skip if already run)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

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
  specs JSONB DEFAULT '[]',
  history JSONB DEFAULT '[]',
  status TEXT DEFAULT 'available',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE vehicles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Vehicles are publicly readable" ON vehicles;
CREATE POLICY "Vehicles are publicly readable"
  ON vehicles FOR SELECT USING (status = 'available');

-- Seed inventory (safe to re-run: upserts by slug)
INSERT INTO vehicles (slug, make, model, year, trim, price, mileage, fuel_type, transmission, condition, body_type, location, engine_size, color, vin, description, featured, images, specs, history)
VALUES
  ('2023-bmw-x5-xdrive40i', 'BMW', 'X5', 2023, 'xDrive40i', 58900, 18420, 'Petrol', 'Automatic', 'Certified Pre-Owned', 'SUV', 'Goshen, IN', '3.0L Turbo I6', 'Alpine White', '5UXCR6C05P9K48291', 'Meticulously maintained BMW X5 with full service history.', true, ARRAY['https://images.unsplash.com/photo-1555215695-3004980ad54e?w=1200&q=80','https://images.unsplash.com/photo-1618843479313-40f8afb4b4d8?w=1200&q=80'], '[{"label":"Drivetrain","value":"AWD"},{"label":"Horsepower","value":"335 hp"}]'::jsonb, '[{"date":"Jan 2026","title":"Certified Inspection","description":"Passed 150-point inspection"}]'::jsonb),
  ('2022-mercedes-benz-e350', 'Mercedes-Benz', 'E-Class', 2022, 'E 350', 47200, 22100, 'Petrol', 'Automatic', 'Used', 'Luxury', 'South Bend, IN', '2.0L Turbo I4', 'Obsidian Black', 'W1KZF8DB5NB123456', 'Elegant Mercedes-Benz E-Class with MBUX infotainment.', true, ARRAY['https://images.unsplash.com/photo-1618843479615-39bca06f2390?w=1200&q=80'], '[]'::jsonb, '[]'::jsonb),
  ('2024-toyota-camry-xse', 'Toyota', 'Camry', 2024, 'XSE', 32800, 8900, 'Hybrid', 'CVT', 'Certified Pre-Owned', 'Sedan', 'Goshen, IN', '2.5L Hybrid I4', 'Midnight Black', '4T1G11AK8RU789012', 'Nearly new Toyota Camry Hybrid XSE.', true, ARRAY['https://images.unsplash.com/photo-1621007947382-bcb3e783bb0e?w=1200&q=80'], '[]'::jsonb, '[]'::jsonb),
  ('2023-ford-f150-lariat', 'Ford', 'F-150', 2023, 'Lariat', 52400, 15600, 'Petrol', 'Automatic', 'Used', 'Truck', 'Elkhart, IN', '3.5L EcoBoost V6', 'Agate Black', '1FTEW1EP5PKA34567', 'Capable Ford F-150 Lariat with towing package.', true, ARRAY['https://images.unsplash.com/photo-1533473359331-0135ef1eb58e?w=1200&q=80'], '[]'::jsonb, '[]'::jsonb),
  ('2024-tesla-model-3-long-range', 'Tesla', 'Model 3', 2024, 'Long Range', 38900, 6200, 'Electric', 'Automatic', 'Certified Pre-Owned', 'Electric', 'Goshen, IN', 'Dual Motor AWD', 'Pearl White', '5YJ3E1EA8RF890123', 'Tesla Model 3 Long Range with verified battery health.', true, ARRAY['https://images.unsplash.com/photo-1560958089-b8a1929cea89?w=1200&q=80'], '[]'::jsonb, '[]'::jsonb),
  ('2022-honda-cr-v-touring', 'Honda', 'CR-V', 2022, 'Touring', 29500, 31200, 'Petrol', 'CVT', 'Used', 'SUV', 'Mishawaka, IN', '1.5L Turbo I4', 'Radiant Red', '7FARW2H85NE456789', 'Reliable Honda CR-V Touring.', false, ARRAY['https://images.unsplash.com/photo-1606664515524-ed2f786a0bd6?w=1200&q=80'], '[]'::jsonb, '[]'::jsonb),
  ('2021-ram-2500-laramie', 'Ram', '2500', 2021, 'Laramie', 44800, 42800, 'Diesel', 'Automatic', 'Used', 'Truck', 'Goshen, IN', '6.7L Cummins Turbo Diesel', 'Granite Crystal', '3C6UR5FL8MG567890', 'Heavy-duty Ram 2500 Laramie.', false, ARRAY['https://images.unsplash.com/photo-1590362891991-f776e747e588?w=1200&q=80'], '[]'::jsonb, '[]'::jsonb),
  ('2023-ford-transit-cargo', 'Ford', 'Transit', 2023, 'Cargo Van', 36200, 24100, 'Petrol', 'Automatic', 'Used', 'Commercial', 'Elkhart, IN', '3.5L V6', 'Oxford White', '1FTBR1XM8PKA678901', 'Ford Transit Cargo Van ready for business.', false, ARRAY['https://images.unsplash.com/photo-1449965408869-eaa3f722e40d?w=1200&q=80'], '[]'::jsonb, '[]'::jsonb),
  ('2024-audi-a6-premium-plus', 'Audi', 'A6', 2024, 'Premium Plus', 51800, 11200, 'Petrol', 'Automatic', 'Certified Pre-Owned', 'Luxury', 'Goshen, IN', '2.0L Turbo I4', 'Daytona Gray', 'WAUZZZF46RN789012', 'Sophisticated Audi A6 with quattro AWD.', true, ARRAY['https://images.unsplash.com/photo-1606664515524-ed2f786a0bd6?w=1200&q=80'], '[]'::jsonb, '[]'::jsonb),
  ('2022-chevrolet-silverado-lt', 'Chevrolet', 'Silverado', 2022, 'LT', 38900, 35600, 'Petrol', 'Automatic', 'Used', 'Truck', 'South Bend, IN', '5.3L V8', 'Summit White', '3GCUYDED5NG890123', 'Chevrolet Silverado 1500 LT.', false, ARRAY['https://images.unsplash.com/photo-1533473359331-0135ef1eb58e?w=1200&q=80'], '[]'::jsonb, '[]'::jsonb),
  ('2023-lexus-rx-350', 'Lexus', 'RX', 2023, '350', 48200, 19800, 'Petrol', 'Automatic', 'Certified Pre-Owned', 'Luxury', 'Goshen, IN', '2.4L Turbo I4', 'Caviar', '2T2BZMCA8PC901234', 'Refined Lexus RX 350.', false, ARRAY['https://images.unsplash.com/photo-1618843479615-39bca06f2390?w=1200&q=80'], '[]'::jsonb, '[]'::jsonb),
  ('2024-hyundai-ioniq-5', 'Hyundai', 'IONIQ 5', 2024, 'SEL', 36500, 7800, 'Electric', 'Automatic', 'Certified Pre-Owned', 'Electric', 'Mishawaka, IN', 'Single Motor RWD', 'Digital Teal', 'KMHM34AC8RA012345', 'Award-winning Hyundai IONIQ 5.', false, ARRAY['https://images.unsplash.com/photo-1617788138017-80ad40651399?w=1200&q=80'], '[]'::jsonb, '[]'::jsonb)
ON CONFLICT (slug) DO UPDATE SET
  price = EXCLUDED.price,
  mileage = EXCLUDED.mileage,
  featured = EXCLUDED.featured,
  updated_at = NOW();
