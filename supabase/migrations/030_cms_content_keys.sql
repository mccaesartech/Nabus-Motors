-- Corporate CMS content keys for site_content (idempotent seed).
-- Defaults in src/lib/site-content/corporate-defaults.ts apply when rows are absent.

INSERT INTO site_content (section, content) VALUES
  ('corporate_homepage', '{}'::jsonb),
  ('corporate_services', '{}'::jsonb),
  ('corporate_stats', '{}'::jsonb),
  ('corporate_faq', '{}'::jsonb),
  ('corporate_services_page', '{}'::jsonb),
  ('freight_landing', '{}'::jsonb),
  ('shipping_consultation', '{}'::jsonb),
  ('spare_parts_landing', '{}'::jsonb)
ON CONFLICT (section) DO NOTHING;
