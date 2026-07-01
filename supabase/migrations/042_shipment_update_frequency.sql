-- Shipment customer notification frequency (every_update | milestones_only)
INSERT INTO site_settings (key, value) VALUES
  ('shipment_update_frequency', 'every_update')
ON CONFLICT (key) DO NOTHING;
