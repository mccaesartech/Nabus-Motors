-- Customer shopping carts and parts orders

-- ─── Saved carts (logged-in customers) ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS customer_carts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id)
);

CREATE TABLE IF NOT EXISTS cart_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  cart_id UUID NOT NULL REFERENCES customer_carts(id) ON DELETE CASCADE,
  part_id UUID NOT NULL REFERENCES parts(id) ON DELETE CASCADE,
  quantity INTEGER NOT NULL DEFAULT 1 CHECK (quantity > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (cart_id, part_id)
);

CREATE INDEX IF NOT EXISTS idx_cart_items_cart ON cart_items(cart_id);
CREATE INDEX IF NOT EXISTS idx_cart_items_part ON cart_items(part_id);

-- ─── Parts orders (checkout / quote requests) ─────────────────────────────────
CREATE TABLE IF NOT EXISTS parts_orders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  email TEXT NOT NULL,
  name TEXT NOT NULL,
  phone TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  total_usd INTEGER NOT NULL DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE parts_orders
  DROP CONSTRAINT IF EXISTS parts_orders_status_check;

ALTER TABLE parts_orders
  ADD CONSTRAINT parts_orders_status_check
  CHECK (status IN ('pending', 'confirmed', 'fulfilled', 'cancelled'));

CREATE TABLE IF NOT EXISTS parts_order_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id UUID NOT NULL REFERENCES parts_orders(id) ON DELETE CASCADE,
  part_id UUID REFERENCES parts(id) ON DELETE SET NULL,
  part_name TEXT NOT NULL,
  part_slug TEXT,
  sku TEXT,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  unit_price_usd INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_parts_orders_user ON parts_orders(user_id);
CREATE INDEX IF NOT EXISTS idx_parts_orders_email ON parts_orders(email);
CREATE INDEX IF NOT EXISTS idx_parts_order_items_order ON parts_order_items(order_id);

-- ─── updated_at triggers ──────────────────────────────────────────────────────
DROP TRIGGER IF EXISTS trg_customer_carts_updated ON customer_carts;
CREATE TRIGGER trg_customer_carts_updated
  BEFORE UPDATE ON customer_carts
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_cart_items_updated ON cart_items;
CREATE TRIGGER trg_cart_items_updated
  BEFORE UPDATE ON cart_items
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_parts_orders_updated ON parts_orders;
CREATE TRIGGER trg_parts_orders_updated
  BEFORE UPDATE ON parts_orders
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ─── RLS ──────────────────────────────────────────────────────────────────────
ALTER TABLE customer_carts ENABLE ROW LEVEL SECURITY;
ALTER TABLE cart_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE parts_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE parts_order_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role manages customer carts" ON customer_carts;
CREATE POLICY "Service role manages customer carts"
  ON customer_carts FOR ALL USING (false) WITH CHECK (false);

DROP POLICY IF EXISTS "Service role manages cart items" ON cart_items;
CREATE POLICY "Service role manages cart items"
  ON cart_items FOR ALL USING (false) WITH CHECK (false);

DROP POLICY IF EXISTS "Service role manages parts orders" ON parts_orders;
CREATE POLICY "Service role manages parts orders"
  ON parts_orders FOR ALL USING (false) WITH CHECK (false);

DROP POLICY IF EXISTS "Service role manages parts order items" ON parts_order_items;
CREATE POLICY "Service role manages parts order items"
  ON parts_order_items FOR ALL USING (false) WITH CHECK (false);

-- ─── Admin notification on new parts order ────────────────────────────────────
CREATE OR REPLACE FUNCTION notify_parts_order()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO admin_notifications (type, title, message, link, source_table, source_id)
  VALUES (
    'inquiry',
    'New parts order',
    format('%s — total $%s USD', NEW.name, NEW.total_usd),
    '/platform/parts/orders',
    'parts_orders',
    NEW.id
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_parts_order ON parts_orders;
CREATE TRIGGER trg_notify_parts_order
  AFTER INSERT ON parts_orders
  FOR EACH ROW EXECUTE FUNCTION notify_parts_order();
