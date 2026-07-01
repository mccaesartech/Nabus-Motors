-- Additional CMS content keys + shipment index (idempotent)

INSERT INTO site_content (section, content) VALUES
  ('corporate_divisions', '{}'::jsonb),
  ('inventory_page', '{}'::jsonb),
  ('freight_tracking', '{}'::jsonb)
ON CONFLICT (section) DO NOTHING;

CREATE INDEX IF NOT EXISTS idx_shipment_tracking_reference
  ON shipment_tracking(reference_type, reference_id);
