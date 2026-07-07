-- Price drop alerts for vehicle detail page

CREATE TABLE IF NOT EXISTS price_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id TEXT NOT NULL,
  vehicle_slug TEXT,
  vehicle_name TEXT,
  price_usd_at_signup NUMERIC NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_price_alerts_vehicle_id ON price_alerts(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_price_alerts_email ON price_alerts(email);
CREATE INDEX IF NOT EXISTS idx_price_alerts_status ON price_alerts(status);

COMMENT ON TABLE price_alerts IS
  'Customer price-drop notifications — signed up from vehicle detail page';
