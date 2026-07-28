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
