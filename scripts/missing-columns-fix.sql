-- Combined vehicle column migrations (060–067, 069)
-- Run once in Supabase Dashboard → SQL Editor if admin saves fail with
-- "column vehicles.<name> does not exist".
--
-- Safe to re-run: every ADD uses IF NOT EXISTS.

-- 060: gallery + primary/additional images
ALTER TABLE vehicles
  ADD COLUMN IF NOT EXISTS gallery JSONB
  DEFAULT '{"exterior":[],"interior":[],"engine":[],"other":[]}'::jsonb;

ALTER TABLE vehicles
  ADD COLUMN IF NOT EXISTS primary_image_url TEXT;

ALTER TABLE vehicles
  ADD COLUMN IF NOT EXISTS additional_images TEXT[] DEFAULT '{}';

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

UPDATE vehicles
SET additional_images = images[2:array_length(images, 1)]
WHERE (additional_images IS NULL OR cardinality(additional_images) = 0)
  AND images IS NOT NULL
  AND array_length(images, 1) > 1;

-- 062: trust badges + filter fields
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

-- 064: warranty notes
ALTER TABLE vehicles
  ADD COLUMN IF NOT EXISTS warranty_notes TEXT;

-- 065: walkaround video
ALTER TABLE vehicles
  ADD COLUMN IF NOT EXISTS walkaround_video_url TEXT;

-- 067: local availability
ALTER TABLE vehicles
  ADD COLUMN IF NOT EXISTS available_locally BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE vehicles
  ADD COLUMN IF NOT EXISTS local_availability_at TIMESTAMPTZ;

-- 069: filter defaults + constraints (requires 062 + 067 columns)
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

-- Notify PostgREST to reload schema
NOTIFY pgrst, 'reload schema';
