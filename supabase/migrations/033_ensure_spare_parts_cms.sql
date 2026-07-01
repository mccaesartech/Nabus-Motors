-- Ensure spare parts landing CMS key exists (idempotent).
-- Defaults in src/lib/site-content/corporate-defaults.ts apply when content is empty.

INSERT INTO site_content (section, content) VALUES
  ('spare_parts_landing', '{}'::jsonb)
ON CONFLICT (section) DO NOTHING;
