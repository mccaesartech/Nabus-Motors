-- Freight quote requests: admin notifications + backfill
-- Root cause: migration 028 created freight_quote_requests but no notify trigger,
-- so quotes saved successfully but never appeared in admin_notifications.

CREATE OR REPLACE FUNCTION notify_freight_quote_request()
RETURNS TRIGGER AS $$
DECLARE
  v_service TEXT;
  v_message TEXT;
BEGIN
  v_service := replace(NEW.service_type, '_', ' ');
  v_message := NEW.name || ' requested ' || v_service;
  IF NEW.origin_country IS NOT NULL AND trim(NEW.origin_country) <> '' THEN
    v_message := v_message || ' from ' || trim(NEW.origin_country);
  END IF;

  BEGIN
    INSERT INTO admin_notifications (type, title, message, link, source_table, source_id)
    VALUES (
      'freight_quote',
      'New freight quote request',
      v_message,
      '/platform/freight/quotes',
      'freight_quote_requests',
      NEW.id
    );
  EXCEPTION
    WHEN unique_violation THEN
      NULL;
  END;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_notify_freight_quote ON freight_quote_requests;
CREATE TRIGGER trg_notify_freight_quote
  AFTER INSERT ON freight_quote_requests
  FOR EACH ROW EXECUTE FUNCTION notify_freight_quote_request();

-- Backfill open freight quotes missing from the notification center
INSERT INTO admin_notifications (type, title, message, link, source_table, source_id, created_at)
SELECT
  'freight_quote',
  'New freight quote request',
  f.name || ' requested ' || replace(f.service_type, '_', ' ')
    || CASE
         WHEN f.origin_country IS NOT NULL AND trim(f.origin_country) <> ''
         THEN ' from ' || trim(f.origin_country)
         ELSE ''
       END,
  '/platform/freight/quotes',
  'freight_quote_requests',
  f.id,
  f.created_at
FROM freight_quote_requests f
WHERE f.status IN ('new', 'contacted')
  AND NOT EXISTS (
    SELECT 1
    FROM admin_notifications n
    WHERE n.source_table = 'freight_quote_requests'
      AND n.source_id = f.id
  );
