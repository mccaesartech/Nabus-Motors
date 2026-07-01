-- Fix pre-order inserts failing when notify_admin_inquiry trigger errors.
-- Root cause: trigger referenced unassigned RECORD v_vehicle when vehicle_id is null
-- or vehicle row is missing, rolling back the entire pre-order insert.
-- Also adds missing account-linking columns (from 018) if not yet applied.

-- ─── Account linking columns (idempotent, from 018) ─────────────────────────
CREATE SEQUENCE IF NOT EXISTS customer_registration_seq START 1;

CREATE OR REPLACE FUNCTION public.generate_registration_id()
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
  year_part TEXT := to_char(NOW(), 'YYYY');
  seq_num INTEGER;
BEGIN
  seq_num := nextval('customer_registration_seq');
  RETURN 'TG-' || year_part || '-' || lpad(seq_num::text, 5, '0');
END;
$$;

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS registration_id TEXT,
  ADD COLUMN IF NOT EXISTS email TEXT;

ALTER TABLE preorder_inquiries
  ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS customer_registration_id TEXT,
  ADD COLUMN IF NOT EXISTS vehicle_slug TEXT,
  ADD COLUMN IF NOT EXISTS vehicle_title TEXT,
  ADD COLUMN IF NOT EXISTS vehicle_price_usd INTEGER,
  ADD COLUMN IF NOT EXISTS payment_status TEXT DEFAULT 'pending';

CREATE INDEX IF NOT EXISTS idx_preorder_inquiries_user
  ON preorder_inquiries(user_id);

CREATE INDEX IF NOT EXISTS idx_preorder_inquiries_registration_id
  ON preorder_inquiries(customer_registration_id);

ALTER TABLE admin_notifications
  ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS recipient_user_id UUID,
  ADD COLUMN IF NOT EXISTS recipient_is_owner BOOLEAN NOT NULL DEFAULT false;

-- ─── Safe notification trigger (no unassigned RECORD, no brittle ON CONFLICT) ─
CREATE OR REPLACE FUNCTION notify_admin_inquiry()
RETURNS TRIGGER AS $$
DECLARE
  v_type TEXT;
  v_title TEXT;
  v_message TEXT;
  v_link TEXT;
  v_name TEXT;
  v_metadata JSONB := '{}'::jsonb;
  v_vehicle_title TEXT;
  v_image TEXT;
  v_vid UUID;
  v_vyear INT;
  v_vmake TEXT;
  v_vmodel TEXT;
  v_vslug TEXT;
  v_vprice INT;
  v_vstatus TEXT;
  v_vtrim TEXT;
  v_found BOOLEAN := false;
BEGIN
  v_type := TG_ARGV[0];
  v_link := TG_ARGV[1];

  IF TG_TABLE_NAME = 'preorder_inquiries' THEN
    v_name := NEW.name;

    IF NEW.vehicle_id IS NOT NULL THEN
      SELECT
        v.id, v.year, v.make, v.model, v.slug, v.price, v.status, v.trim,
        CASE
          WHEN v.images IS NOT NULL AND array_length(v.images, 1) > 0 THEN v.images[1]
          ELSE NULL
        END
      INTO
        v_vid, v_vyear, v_vmake, v_vmodel, v_vslug, v_vprice, v_vstatus, v_vtrim, v_image
      FROM vehicles v
      WHERE v.id = NEW.vehicle_id;

      v_found := FOUND;
    END IF;

    v_vehicle_title := COALESCE(
      NEW.vehicle_title,
      CASE
        WHEN v_found THEN trim(concat_ws(' ', v_vyear::text, v_vmake, v_vmodel, v_vtrim))
        ELSE NULL
      END,
      'Unknown vehicle'
    );

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
        'id', COALESCE(NEW.vehicle_id::text, CASE WHEN v_found THEN v_vid::text ELSE NULL END),
        'year', CASE WHEN v_found THEN v_vyear ELSE NULL END,
        'make', CASE WHEN v_found THEN v_vmake ELSE NULL END,
        'model', CASE WHEN v_found THEN v_vmodel ELSE NULL END,
        'slug', COALESCE(NEW.vehicle_slug, CASE WHEN v_found THEN v_vslug ELSE NULL END),
        'price', COALESCE(NEW.vehicle_price_usd, CASE WHEN v_found THEN v_vprice ELSE NULL END),
        'image', v_image,
        'title', v_vehicle_title,
        'status', CASE WHEN v_found THEN v_vstatus ELSE NULL END
      ),
      'downPaymentUsd', NEW.down_payment_usd,
      'downPaymentFormatted', '$' || to_char(COALESCE(NEW.down_payment_usd, 0), 'FM999,999'),
      'paymentStatus', COALESCE(NEW.payment_status, 'pending')
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

  BEGIN
    INSERT INTO admin_notifications (type, title, message, link, source_table, source_id, metadata)
    VALUES (v_type, v_title, v_message, v_link, TG_TABLE_NAME, NEW.id, v_metadata);
  EXCEPTION
    WHEN unique_violation THEN
      NULL;
    WHEN undefined_column THEN
      INSERT INTO admin_notifications (type, title, message, link, source_table, source_id)
      VALUES (v_type, v_title, v_message, v_link, TG_TABLE_NAME, NEW.id);
  END;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_notify_preorder ON preorder_inquiries;
CREATE TRIGGER trg_notify_preorder
  AFTER INSERT ON preorder_inquiries
  FOR EACH ROW EXECUTE FUNCTION notify_admin_inquiry('preorder', '/platform/leads?tab=preorder');

DROP POLICY IF EXISTS "Users can view own preorder inquiries" ON preorder_inquiries;
CREATE POLICY "Users can view own preorder inquiries"
  ON preorder_inquiries FOR SELECT
  USING (
    auth.uid() = user_id
    OR lower(email) = lower(COALESCE(auth.jwt() ->> 'email', ''))
  );
