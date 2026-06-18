-- Vehicle purchase / rental / test drive inquiries
CREATE TABLE IF NOT EXISTS vehicle_inquiries (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  inquiry_type TEXT NOT NULL,
  vehicle_slug TEXT,
  vehicle_name TEXT,
  message TEXT,
  status TEXT DEFAULT 'new',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE contact_inquiries ENABLE ROW LEVEL SECURITY;
ALTER TABLE appraisal_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE newsletter_subscribers ENABLE ROW LEVEL SECURITY;
ALTER TABLE vehicle_inquiries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can submit contact inquiries"
  ON contact_inquiries FOR INSERT WITH CHECK (true);

CREATE POLICY "Anyone can submit appraisal requests"
  ON appraisal_requests FOR INSERT WITH CHECK (true);

CREATE POLICY "Anyone can subscribe to newsletter"
  ON newsletter_subscribers FOR INSERT WITH CHECK (true);

CREATE POLICY "Anyone can submit vehicle inquiries"
  ON vehicle_inquiries FOR INSERT WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_vehicle_inquiries_status ON vehicle_inquiries(status);
CREATE INDEX IF NOT EXISTS idx_contact_inquiries_status ON contact_inquiries(status);
