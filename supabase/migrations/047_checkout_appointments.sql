-- Post-checkout appointments + vehicle sale notifications

ALTER TABLE vehicle_appointments
  ADD COLUMN IF NOT EXISTS order_id UUID REFERENCES parts_orders(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS inquiry_id UUID REFERENCES preorder_inquiries(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'website',
  ADD COLUMN IF NOT EXISTS vehicle_ids JSONB NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE vehicle_appointments
  DROP CONSTRAINT IF EXISTS vehicle_appointments_source_check;

ALTER TABLE vehicle_appointments
  ADD CONSTRAINT vehicle_appointments_source_check
  CHECK (source IN ('website', 'checkout', 'preorder'));

CREATE INDEX IF NOT EXISTS idx_vehicle_appointments_order
  ON vehicle_appointments(order_id)
  WHERE order_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_vehicle_appointments_inquiry
  ON vehicle_appointments(inquiry_id)
  WHERE inquiry_id IS NOT NULL;

-- Notify admins when a customer requests a showroom appointment
CREATE OR REPLACE FUNCTION notify_vehicle_appointment()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_vehicle TEXT;
BEGIN
  SELECT trim(concat_ws(' ', year::text, make, model))
  INTO v_vehicle
  FROM vehicles
  WHERE id = NEW.vehicle_id;

  BEGIN
    INSERT INTO admin_notifications (type, title, message, link, source_table, source_id, metadata)
    VALUES (
      'appointment',
      'New appointment request',
      NEW.name || COALESCE(' · ' || v_vehicle, ''),
      '/platform/appointments',
      'vehicle_appointments',
      NEW.id,
      jsonb_build_object(
        'customer', jsonb_build_object('name', NEW.name, 'email', NEW.email, 'phone', NEW.phone),
        'preferred_date', NEW.preferred_date,
        'preferred_time', NEW.preferred_time,
        'branch', NEW.branch,
        'source', NEW.source
      )
    );
  EXCEPTION
    WHEN unique_violation THEN
      NULL;
    WHEN undefined_column THEN
      INSERT INTO admin_notifications (type, title, message, link, source_table, source_id)
      VALUES (
        'appointment',
        'New appointment request',
        NEW.name || COALESCE(' · ' || v_vehicle, ''),
        '/platform/appointments',
        'vehicle_appointments',
        NEW.id
      );
  END;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_vehicle_appointment ON vehicle_appointments;
CREATE TRIGGER trg_notify_vehicle_appointment
  AFTER INSERT ON vehicle_appointments
  FOR EACH ROW EXECUTE FUNCTION notify_vehicle_appointment();

-- Richer notification when a cart order includes vehicles (buy / pre-order intent)
CREATE OR REPLACE FUNCTION notify_parts_order()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_vehicle_count INTEGER;
  v_vehicle_lines TEXT;
  v_title TEXT;
  v_message TEXT;
  v_link TEXT;
BEGIN
  SELECT COUNT(*)::INTEGER,
         string_agg(
           part_name || CASE WHEN item_intent = 'pre_order' THEN ' (pre-order)' ELSE ' (buy)' END,
           ', '
         )
  INTO v_vehicle_count, v_vehicle_lines
  FROM parts_order_items
  WHERE order_id = NEW.id AND item_type = 'vehicle';

  IF v_vehicle_count > 0 THEN
    v_title := CASE WHEN v_vehicle_count = 1 THEN 'Vehicle purchase request' ELSE 'Vehicle cart order' END;
    v_message := NEW.name || ' — ' || COALESCE(v_vehicle_lines, v_vehicle_count::text || ' vehicle(s)')
      || ' · order ' || LEFT(NEW.id::text, 8);
    v_link := '/platform/leads/order/' || NEW.id::text;
  ELSE
    v_title := 'New parts order';
    v_message := NEW.name || ' — total ' || NEW.total_usd::text;
    v_link := '/platform/leads/order/' || NEW.id::text;
  END IF;

  BEGIN
    INSERT INTO admin_notifications (type, title, message, link, source_table, source_id, metadata)
    VALUES (
      CASE WHEN v_vehicle_count > 0 THEN 'vehicle_order' ELSE 'inquiry' END,
      v_title,
      v_message,
      v_link,
      'parts_orders',
      NEW.id,
      jsonb_build_object(
        'customer', jsonb_build_object('name', NEW.name, 'email', NEW.email, 'phone', NEW.phone),
        'total_usd', NEW.total_usd,
        'vehicle_count', v_vehicle_count
      )
    );
  EXCEPTION
    WHEN unique_violation THEN
      NULL;
    WHEN undefined_column THEN
      INSERT INTO admin_notifications (type, title, message, link, source_table, source_id)
      VALUES (
        CASE WHEN v_vehicle_count > 0 THEN 'vehicle_order' ELSE 'inquiry' END,
        v_title,
        v_message,
        v_link,
        'parts_orders',
        NEW.id
      );
  END;

  RETURN NEW;
END;
$$;
