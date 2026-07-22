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
