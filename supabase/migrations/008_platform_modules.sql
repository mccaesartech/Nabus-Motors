-- Platform modules: finance expenses, site settings, users, documents

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ─── Expenses ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS expenses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  description TEXT NOT NULL,
  amount_usd INTEGER NOT NULL DEFAULT 0,
  expense_date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_expenses_date ON expenses(expense_date DESC);

-- ─── Site settings (key-value store) ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS site_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL DEFAULT '',
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO site_settings (key, value) VALUES
  ('company_name', 'True Goshen Auto'),
  ('phone', '+233 24 487 6784'),
  ('email', 'info@truegoshenauto.com'),
  ('address', 'Ring Road East, Accra, Greater Accra, Ghana'),
  ('whatsapp_number', '233244876784'),
  ('notification_email', 'info@truegoshenauto.com')
ON CONFLICT (key) DO NOTHING;

-- ─── Platform users (team roster; separate from Supabase auth) ────────────────
CREATE TABLE IF NOT EXISTS platform_users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  role TEXT NOT NULL DEFAULT 'Sales Officer',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_platform_users_email ON platform_users(email);

-- ─── Documents ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS documents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  doc_type TEXT NOT NULL DEFAULT 'other',
  url TEXT,
  vehicle_id UUID REFERENCES vehicles(id) ON DELETE SET NULL,
  customer_name TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_documents_type ON documents(doc_type);

-- ─── RLS (service role bypasses; anon has no access) ────────────────────────
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE site_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE platform_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role manages expenses" ON expenses;
CREATE POLICY "Service role manages expenses"
  ON expenses FOR ALL USING (false) WITH CHECK (false);

DROP POLICY IF EXISTS "Service role manages site_settings" ON site_settings;
CREATE POLICY "Service role manages site_settings"
  ON site_settings FOR ALL USING (false) WITH CHECK (false);

DROP POLICY IF EXISTS "Service role manages platform_users" ON platform_users;
CREATE POLICY "Service role manages platform_users"
  ON platform_users FOR ALL USING (false) WITH CHECK (false);

DROP POLICY IF EXISTS "Service role manages documents" ON documents;
CREATE POLICY "Service role manages documents"
  ON documents FOR ALL USING (false) WITH CHECK (false);
