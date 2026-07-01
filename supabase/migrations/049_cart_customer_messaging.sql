-- Link customer conversations to cart orders for staff messaging context

ALTER TABLE customer_conversations
  ADD COLUMN IF NOT EXISTS parts_order_id UUID REFERENCES parts_orders(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_customer_conversations_parts_order
  ON customer_conversations(parts_order_id)
  WHERE parts_order_id IS NOT NULL;
