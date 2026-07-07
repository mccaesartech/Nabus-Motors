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
