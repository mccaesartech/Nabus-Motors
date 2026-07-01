-- Track when staff confirms a cart order

ALTER TABLE parts_orders
  ADD COLUMN IF NOT EXISTS confirmed_at TIMESTAMPTZ;
