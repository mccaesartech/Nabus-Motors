-- Rich pre-order notifications with vehicle + customer metadata

-- Denormalized vehicle snapshot (survives vehicle deletion / missing FK)
ALTER TABLE preorder_inquiries
  ADD COLUMN IF NOT EXISTS vehicle_slug TEXT,
  ADD COLUMN IF NOT EXISTS vehicle_title TEXT,
  ADD COLUMN IF NOT EXISTS vehicle_price_usd INTEGER;

-- Structured notification payload for admin UI
ALTER TABLE admin_notifications
  ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;

CREATE OR REPLACE FUNCTION notify_admin_inquiry()
RETURNS TRIGGER AS $$
DECLARE
  v_type TEXT;
  v_title TEXT;
  v_message TEXT;
  v_link TEXT;
  v_name TEXT;
  v_metadata JSONB := '{}'::jsonb;
  v_vehicle RECORD;
  v_vehicle_title TEXT;
  v_image TEXT;
BEGIN
  v_type := TG_ARGV[0];
  v_link := TG_ARGV[1];

  IF TG_TABLE_NAME = 'preorder_inquiries' THEN
    v_name := NEW.name;
    v_vehicle := NULL;

    IF NEW.vehicle_id IS NOT NULL THEN
      SELECT id, year, make, model, slug, price, images, trim, status
      INTO v_vehicle
      FROM vehicles
      WHERE id = NEW.vehicle_id;
    END IF;

    v_vehicle_title := COALESCE(
      NEW.vehicle_title,
      CASE
        WHEN v_vehicle.id IS NOT NULL THEN
          v_vehicle.year || ' ' || v_vehicle.make || ' ' || v_vehicle.model
        ELSE NULL
      END,
      'Unknown vehicle'
    );

    v_image := NULL;
    IF v_vehicle.images IS NOT NULL AND array_length(v_vehicle.images, 1) > 0 THEN
      v_image := v_vehicle.images[1];
    END IF;

    v_title := 'Pre-order: ' || v_vehicle_title;
    v_message := v_name || ' · ' || v_vehicle_title || ' · $'
      || to_char(COALESCE(NEW.down_payment_usd, 0), 'FM999,999') || ' down';
    v_link := '/platform/leads/preorder/' || NEW.id::text;

    v_metadata := jsonb_build_object(
      'customer', jsonb_build_object(
        'name', NEW.name,
        'email', NEW.email,
        'phone', NEW.phone,
        'message', NEW.message
      ),
      'vehicle', jsonb_build_object(
        'id', COALESCE(NEW.vehicle_id::text, v_vehicle.id::text),
        'year', COALESCE(v_vehicle.year, NULL),
        'make', v_vehicle.make,
        'model', v_vehicle.model,
        'slug', COALESCE(NEW.vehicle_slug, v_vehicle.slug),
        'price', COALESCE(NEW.vehicle_price_usd, v_vehicle.price),
        'image', v_image,
        'title', v_vehicle_title,
        'status', v_vehicle.status
      ),
      'downPaymentUsd', NEW.down_payment_usd,
      'downPaymentFormatted', '$' || to_char(COALESCE(NEW.down_payment_usd, 0), 'FM999,999')
    );

  ELSIF TG_TABLE_NAME = 'vehicle_inquiries' THEN
    v_name := NEW.name;
    v_title := 'New vehicle inquiry';
    v_message := v_name || ' inquired about ' || COALESCE(NEW.vehicle_name, NEW.vehicle_slug, 'a vehicle');
  ELSIF TG_TABLE_NAME = 'contact_inquiries' THEN
    v_name := NEW.name;
    v_title := 'New contact message';
    v_message := v_name || ': ' || LEFT(COALESCE(NEW.subject, NEW.message, ''), 80);
  ELSIF TG_TABLE_NAME = 'finance_applications' THEN
    v_name := NEW.first_name || ' ' || NEW.last_name;
    v_title := 'New finance application';
    v_message := TRIM(v_name) || ' applied for financing';
  ELSIF TG_TABLE_NAME = 'appraisal_requests' THEN
    v_name := NEW.seller_name;
    v_title := 'New appraisal request';
    v_message := v_name || ' wants to sell a ' || NEW.year || ' ' || NEW.make || ' ' || NEW.model;
  ELSE
    RETURN NEW;
  END IF;

  INSERT INTO admin_notifications (type, title, message, link, source_table, source_id, metadata)
  VALUES (v_type, v_title, v_message, v_link, TG_TABLE_NAME, NEW.id, v_metadata)
  ON CONFLICT (source_table, source_id) WHERE source_id IS NOT NULL DO NOTHING;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Re-create preorder trigger (link overridden in function for pre-orders)
DROP TRIGGER IF EXISTS trg_notify_preorder ON preorder_inquiries;
CREATE TRIGGER trg_notify_preorder
  AFTER INSERT ON preorder_inquiries
  FOR EACH ROW EXECUTE FUNCTION notify_admin_inquiry('preorder', '/platform/leads?tab=preorder');

-- Backfill denormalized vehicle fields on existing pre-orders
UPDATE preorder_inquiries p
SET
  vehicle_slug = COALESCE(p.vehicle_slug, v.slug),
  vehicle_title = COALESCE(
    p.vehicle_title,
    v.year || ' ' || v.make || ' ' || v.model
  ),
  vehicle_price_usd = COALESCE(p.vehicle_price_usd, v.price)
FROM vehicles v
WHERE p.vehicle_id = v.id
  AND (p.vehicle_slug IS NULL OR p.vehicle_title IS NULL OR p.vehicle_price_usd IS NULL);

-- Refresh existing pre-order notifications with rich content
UPDATE admin_notifications n
SET
  title = 'Pre-order: ' || COALESCE(
    p.vehicle_title,
    v.year || ' ' || v.make || ' ' || v.model,
    'Unknown vehicle'
  ),
  message = p.name || ' · ' || COALESCE(
    p.vehicle_title,
    v.year || ' ' || v.make || ' ' || v.model,
    'Unknown vehicle'
  ) || ' · $' || to_char(COALESCE(p.down_payment_usd, 0), 'FM999,999') || ' down',
  link = '/platform/leads/preorder/' || p.id::text,
  metadata = jsonb_build_object(
    'customer', jsonb_build_object(
      'name', p.name,
      'email', p.email,
      'phone', p.phone,
      'message', p.message
    ),
    'vehicle', jsonb_build_object(
      'id', COALESCE(p.vehicle_id::text, v.id::text),
      'year', v.year,
      'make', v.make,
      'model', v.model,
      'slug', COALESCE(p.vehicle_slug, v.slug),
      'price', COALESCE(p.vehicle_price_usd, v.price),
      'image', CASE
        WHEN v.images IS NOT NULL AND array_length(v.images, 1) > 0 THEN v.images[1]
        ELSE NULL
      END,
      'title', COALESCE(
        p.vehicle_title,
        v.year || ' ' || v.make || ' ' || v.model,
        'Unknown vehicle'
      ),
      'status', v.status
    ),
    'downPaymentUsd', p.down_payment_usd,
    'downPaymentFormatted', '$' || to_char(COALESCE(p.down_payment_usd, 0), 'FM999,999')
  )
FROM preorder_inquiries p
LEFT JOIN vehicles v ON v.id = p.vehicle_id
WHERE n.source_table = 'preorder_inquiries'
  AND n.source_id = p.id;
