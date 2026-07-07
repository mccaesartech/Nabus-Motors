-- Optional per-vehicle warranty notes for detail page display

ALTER TABLE vehicles
  ADD COLUMN IF NOT EXISTS warranty_notes TEXT;

COMMENT ON COLUMN vehicles.warranty_notes IS
  'Optional warranty coverage notes shown on the vehicle detail page; sensible defaults apply when null';
