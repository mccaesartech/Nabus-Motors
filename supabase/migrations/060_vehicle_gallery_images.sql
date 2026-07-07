-- Primary listing image + unlimited additional gallery images per vehicle.
-- Keeps existing gallery JSONB in sync for backward compatibility.

ALTER TABLE vehicles
  ADD COLUMN IF NOT EXISTS gallery JSONB
  DEFAULT '{"exterior":[],"interior":[],"engine":[],"other":[]}'::jsonb;

ALTER TABLE vehicles
  ADD COLUMN IF NOT EXISTS primary_image_url TEXT;

ALTER TABLE vehicles
  ADD COLUMN IF NOT EXISTS additional_images TEXT[] DEFAULT '{}';

-- Backfill primary from first exterior gallery shot or legacy images[].
UPDATE vehicles
SET primary_image_url = COALESCE(
  NULLIF(TRIM(gallery->'exterior'->>0), ''),
  images[1]
)
WHERE primary_image_url IS NULL
  AND (
    (gallery->'exterior'->>0) IS NOT NULL
    OR (images IS NOT NULL AND array_length(images, 1) > 0)
  );

-- Backfill additional from legacy images[] tail when column is empty.
UPDATE vehicles
SET additional_images = images[2:array_length(images, 1)]
WHERE (additional_images IS NULL OR cardinality(additional_images) = 0)
  AND images IS NOT NULL
  AND array_length(images, 1) > 1;

-- Backfill additional from categorized gallery (everything after primary).
UPDATE vehicles v
SET additional_images = sub.urls
FROM (
  SELECT
    id,
    ARRAY(
      SELECT DISTINCT url
      FROM (
        SELECT jsonb_array_elements_text(COALESCE(gallery->'exterior', '[]'::jsonb)) AS url
        UNION ALL
        SELECT jsonb_array_elements_text(COALESCE(gallery->'interior', '[]'::jsonb))
        UNION ALL
        SELECT jsonb_array_elements_text(COALESCE(gallery->'engine', '[]'::jsonb))
        UNION ALL
        SELECT jsonb_array_elements_text(COALESCE(gallery->'other', '[]'::jsonb))
      ) AS all_urls
      WHERE url IS NOT NULL
        AND TRIM(url) <> ''
        AND url <> COALESCE(primary_image_url, '')
    ) AS urls
  FROM vehicles
  WHERE gallery IS NOT NULL
    AND gallery <> '{"exterior":[],"interior":[],"engine":[],"other":[]}'::jsonb
) sub
WHERE v.id = sub.id
  AND (v.additional_images IS NULL OR cardinality(v.additional_images) = 0)
  AND cardinality(sub.urls) > 0;
