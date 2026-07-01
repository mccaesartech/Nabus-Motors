-- Complete CMS coverage for Auto Divisions + Tracking form copy (idempotent).
-- Defaults in src/lib/site-content/corporate-defaults.ts apply when fields are absent.

INSERT INTO site_content (section, content) VALUES
  ('corporate_divisions', '{}'::jsonb),
  ('freight_tracking', '{}'::jsonb)
ON CONFLICT (section) DO NOTHING;
