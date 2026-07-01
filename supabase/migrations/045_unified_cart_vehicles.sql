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
