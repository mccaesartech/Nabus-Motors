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
