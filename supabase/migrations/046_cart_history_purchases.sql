-- Unified order items (parts + vehicles) and expanded order statuses

ALTER TABLE parts_order_items
  ADD COLUMN IF NOT EXISTS item_type TEXT NOT NULL DEFAULT 'part',
  ADD COLUMN IF NOT EXISTS vehicle_id UUID REFERENCES vehicles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS item_intent TEXT;

ALTER TABLE parts_order_items
  ALTER COLUMN part_id DROP NOT NULL;

ALTER TABLE parts_order_items
  DROP CONSTRAINT IF EXISTS parts_order_items_item_type_check;

ALTER TABLE parts_order_items
  ADD CONSTRAINT parts_order_items_item_type_check
  CHECK (item_type IN ('part', 'vehicle'));

ALTER TABLE parts_order_items
  DROP CONSTRAINT IF EXISTS parts_order_items_item_ref_check;

ALTER TABLE parts_order_items
  ADD CONSTRAINT parts_order_items_item_ref_check
  CHECK (
    (item_type = 'part' AND part_id IS NOT NULL)
    OR (item_type = 'vehicle' AND vehicle_id IS NOT NULL)
  );

ALTER TABLE parts_order_items
  DROP CONSTRAINT IF EXISTS parts_order_items_item_intent_check;

ALTER TABLE parts_order_items
  ADD CONSTRAINT parts_order_items_item_intent_check
  CHECK (item_intent IS NULL OR item_intent IN ('buy', 'pre_order'));

CREATE INDEX IF NOT EXISTS idx_parts_order_items_vehicle
  ON parts_order_items(vehicle_id)
  WHERE vehicle_id IS NOT NULL;

ALTER TABLE parts_orders
  DROP CONSTRAINT IF EXISTS parts_orders_status_check;

ALTER TABLE parts_orders
  ADD CONSTRAINT parts_orders_status_check
  CHECK (status IN ('pending', 'confirmed', 'shipped', 'fulfilled', 'cancelled'));
