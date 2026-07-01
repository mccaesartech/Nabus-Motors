-- True Goshen Platform — customers, sales, lead extensions
-- Safe to run multiple times; does not alter existing vehicle/inquiry schemas destructively

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ─── Customers ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS customers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  first_name TEXT,
  last_name TEXT,
  email TEXT UNIQUE NOT NULL,
  phone TEXT,
  source TEXT DEFAULT 'website',
  status TEXT DEFAULT 'active',
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─── Sales ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS sales (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
  vehicle_id UUID REFERENCES vehicles(id) ON DELETE SET NULL,
  sale_price INTEGER NOT NULL DEFAULT 0,
  status TEXT DEFAULT 'pending',
  sale_date TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─── Lead extensions (source + follow-up notes) ───────────────────────────────
ALTER TABLE contact_inquiries
  ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'website',
  ADD COLUMN IF NOT EXISTS follow_up_notes TEXT;

ALTER TABLE vehicle_inquiries
  ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'website',
  ADD COLUMN IF NOT EXISTS follow_up_notes TEXT;

ALTER TABLE finance_applications
  ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'website',
  ADD COLUMN IF NOT EXISTS follow_up_notes TEXT;

ALTER TABLE appraisal_requests
  ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'website',
  ADD COLUMN IF NOT EXISTS follow_up_notes TEXT;

-- ─── Indexes ────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_customers_email ON customers(email);
CREATE INDEX IF NOT EXISTS idx_customers_status ON customers(status);
CREATE INDEX IF NOT EXISTS idx_sales_status ON sales(status);
CREATE INDEX IF NOT EXISTS idx_sales_customer ON sales(customer_id);
CREATE INDEX IF NOT EXISTS idx_sales_vehicle ON sales(vehicle_id);

-- ─── RLS (service role bypasses; anon has no access) ────────────────────────
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role manages customers" ON customers;
CREATE POLICY "Service role manages customers"
  ON customers FOR ALL USING (false) WITH CHECK (false);

DROP POLICY IF EXISTS "Service role manages sales" ON sales;
CREATE POLICY "Service role manages sales"
  ON sales FOR ALL USING (false) WITH CHECK (false);

-- ─── Updated_at triggers ────────────────────────────────────────────────────
DROP TRIGGER IF EXISTS customers_updated_at ON customers;
CREATE TRIGGER customers_updated_at
  BEFORE UPDATE ON customers
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS sales_updated_at ON sales;
CREATE TRIGGER sales_updated_at
  BEFORE UPDATE ON sales
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
