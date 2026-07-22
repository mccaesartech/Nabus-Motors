-- OPTIONAL / SAFE: correct stored vehicle.color for known Pexels stock placeholders only.
--
-- This script updates rows where the primary listing image (vehicles.images[1]) is a
-- Pexels URL whose photo id appears in src/lib/data/car-photo-colors.json. The color
-- column is set to that file's annotated exterior label. Custom uploads, CDN URLs,
-- and vehicles whose first image is not in the mapping are not modified.
--
-- Run the dry-run SELECT first and confirm the listed slugs. Then run the UPDATE block
-- in the same session if you want to apply changes.

-- Dry run (read-only): mismatches only
WITH stock_colors(photo_id, label) AS (
  VALUES
  (112452::bigint, 'Atomic Grey'),
  (112460::bigint, 'Graphite Grey'),
  (164634::bigint, 'Graphite Grey'),
  (170811::bigint, 'Deep Blue'),
  (210019::bigint, 'Champagne Gold'),
  (244206::bigint, 'Atomic Grey'),
  (712618::bigint, 'Atomic Grey'),
  (919073::bigint, 'Obsidian Black'),
  (1144720::bigint, 'Deep Blue'),
  (1166754::bigint, 'Silver Frost'),
  (1545743::bigint, 'Atomic Grey'),
  (1592384::bigint, 'Graphite Grey'),
  (2264333::bigint, 'Graphite Grey'),
  (3593929::bigint, 'Graphite Grey'),
  (3720372::bigint, 'Atomic Grey'),
  (3764984::bigint, 'Graphite Grey'),
  (4997317::bigint, 'Champagne Gold'),
  (6870896::bigint, 'Midnight Black'),
  (9105627::bigint, 'Atomic Grey'),
  (9799996::bigint, 'Silver Frost'),
  (9800029::bigint, 'Graphite Grey'),
  (11567721::bigint, 'Atomic Grey'),
  (12681049::bigint, 'Deep Green'),
  (13804269::bigint, 'Graphite Grey'),
  (14438397::bigint, 'Atomic Grey'),
  (14776590::bigint, 'Atomic Grey'),
  (14965004::bigint, 'Atomic Grey'),
  (15768199::bigint, 'Atomic Grey'),
  (16363816::bigint, 'Atomic Grey'),
  (20584482::bigint, 'Atomic Grey'),
  (23220477::bigint, 'Midnight Black'),
  (25851807::bigint, 'Silver Frost'),
  (30360699::bigint, 'Graphite Grey'),
  (30479248::bigint, 'Atomic Grey'),
  (31661243::bigint, 'Atomic Grey'),
  (32078946::bigint, 'Graphite Grey'),
  (32462525::bigint, 'Graphite Grey'),
  (32536591::bigint, 'Atomic Grey'),
  (33336584::bigint, 'Atomic Grey'),
  (35736766::bigint, 'Atomic Grey'),
  (35736777::bigint, 'Atomic Grey'),
  (35736787::bigint, 'Graphite Grey'),
  (37049415::bigint, 'Graphite Grey')
),
matched AS (
  SELECT
    v.slug,
    v.color AS current_color,
    sc.label AS expected_color,
    sc.photo_id
  FROM vehicles v
  INNER JOIN stock_colors sc
    ON sc.photo_id = (
      (regexp_match(v.images[1], 'pexels\.com/photos/(\d+)/', 'i'))[1]
    )::bigint
  WHERE v.images IS NOT NULL
    AND cardinality(v.images) >= 1
    AND v.images[1] IS NOT NULL
    AND v.images[1] ~* 'pexels\.com/photos/\d+/'
)
SELECT slug, current_color, expected_color, photo_id
FROM matched
WHERE current_color IS DISTINCT FROM expected_color
ORDER BY slug;

-- Apply corrections (optional; same mapping as car-photo-colors.json)
UPDATE vehicles AS v
SET
  color = sc.label,
  updated_at = NOW()
FROM (
  VALUES
  (112452::bigint, 'Atomic Grey'),
  (112460::bigint, 'Graphite Grey'),
  (164634::bigint, 'Graphite Grey'),
  (170811::bigint, 'Deep Blue'),
  (210019::bigint, 'Champagne Gold'),
  (244206::bigint, 'Atomic Grey'),
  (712618::bigint, 'Atomic Grey'),
  (919073::bigint, 'Obsidian Black'),
  (1144720::bigint, 'Deep Blue'),
  (1166754::bigint, 'Silver Frost'),
  (1545743::bigint, 'Atomic Grey'),
  (1592384::bigint, 'Graphite Grey'),
  (2264333::bigint, 'Graphite Grey'),
  (3593929::bigint, 'Graphite Grey'),
  (3720372::bigint, 'Atomic Grey'),
  (3764984::bigint, 'Graphite Grey'),
  (4997317::bigint, 'Champagne Gold'),
  (6870896::bigint, 'Midnight Black'),
  (9105627::bigint, 'Atomic Grey'),
  (9799996::bigint, 'Silver Frost'),
  (9800029::bigint, 'Graphite Grey'),
  (11567721::bigint, 'Atomic Grey'),
  (12681049::bigint, 'Deep Green'),
  (13804269::bigint, 'Graphite Grey'),
  (14438397::bigint, 'Atomic Grey'),
  (14776590::bigint, 'Atomic Grey'),
  (14965004::bigint, 'Atomic Grey'),
  (15768199::bigint, 'Atomic Grey'),
  (16363816::bigint, 'Atomic Grey'),
  (20584482::bigint, 'Atomic Grey'),
  (23220477::bigint, 'Midnight Black'),
  (25851807::bigint, 'Silver Frost'),
  (30360699::bigint, 'Graphite Grey'),
  (30479248::bigint, 'Atomic Grey'),
  (31661243::bigint, 'Atomic Grey'),
  (32078946::bigint, 'Graphite Grey'),
  (32462525::bigint, 'Graphite Grey'),
  (32536591::bigint, 'Atomic Grey'),
  (33336584::bigint, 'Atomic Grey'),
  (35736766::bigint, 'Atomic Grey'),
  (35736777::bigint, 'Atomic Grey'),
  (35736787::bigint, 'Graphite Grey'),
  (37049415::bigint, 'Graphite Grey')
) AS sc(photo_id, label)
WHERE v.images IS NOT NULL
  AND cardinality(v.images) >= 1
  AND v.images[1] IS NOT NULL
  AND sc.photo_id = (
    (regexp_match(v.images[1], 'pexels\.com/photos/(\d+)/', 'i'))[1]
  )::bigint
  AND v.color IS DISTINCT FROM sc.label;
