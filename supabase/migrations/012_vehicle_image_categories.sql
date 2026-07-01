-- Categorized vehicle photo galleries (exterior, interior, engine, other)
ALTER TABLE vehicles
  ADD COLUMN IF NOT EXISTS gallery JSONB
  DEFAULT '{"exterior":[],"interior":[],"engine":[],"other":[]}'::jsonb;

-- Migrate legacy images[] into gallery.exterior
UPDATE vehicles
SET gallery = jsonb_build_object(
  'exterior', COALESCE(
    (SELECT jsonb_agg(to_jsonb(url)) FROM unnest(images) AS url),
    '[]'::jsonb
  ),
  'interior', '[]'::jsonb,
  'engine', '[]'::jsonb,
  'other', '[]'::jsonb
)
WHERE images IS NOT NULL
  AND array_length(images, 1) > 0
  AND (
    gallery IS NULL
    OR gallery = '{"exterior":[],"interior":[],"engine":[],"other":[]}'::jsonb
  );
