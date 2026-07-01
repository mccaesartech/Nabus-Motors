-- Custom vehicle pre-order requests (cars not in catalog)

ALTER TABLE preorder_inquiries
  ADD COLUMN IF NOT EXISTS is_custom_request BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS requested_make TEXT,
  ADD COLUMN IF NOT EXISTS requested_model TEXT,
  ADD COLUMN IF NOT EXISTS requested_year TEXT,
  ADD COLUMN IF NOT EXISTS requested_specs JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS budget_min INTEGER,
  ADD COLUMN IF NOT EXISTS budget_max INTEGER,
  ADD COLUMN IF NOT EXISTS reference_code TEXT,
  ADD COLUMN IF NOT EXISTS matched_vehicle_id UUID REFERENCES vehicles(id) ON DELETE SET NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_preorder_inquiries_reference_code
  ON preorder_inquiries(reference_code)
  WHERE reference_code IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_preorder_inquiries_custom
  ON preorder_inquiries(is_custom_request, created_at DESC)
  WHERE is_custom_request = true;

CREATE OR REPLACE FUNCTION public.generate_custom_request_reference_code()
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
  date_part TEXT := to_char(NOW(), 'YYYYMMDD');
  suffix TEXT;
  candidate TEXT;
  attempts INTEGER := 0;
BEGIN
  LOOP
    suffix := upper(substr(md5(random()::text || clock_timestamp()::text), 1, 4));
    candidate := 'CR-' || date_part || '-' || suffix;
    IF NOT EXISTS (
      SELECT 1 FROM preorder_inquiries WHERE reference_code = candidate
    ) THEN
      RETURN candidate;
    END IF;
    attempts := attempts + 1;
    IF attempts > 20 THEN
      RAISE EXCEPTION 'Could not generate unique custom request reference code';
    END IF;
  END LOOP;
END;
$$;

-- Notify admins with custom-request-specific title when applicable
CREATE OR REPLACE FUNCTION public.notify_admin_inquiry()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_type TEXT;
  v_link TEXT;
  v_title TEXT;
  v_message TEXT;
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
  v_specs JSONB;
  v_budget TEXT;
BEGIN
  v_type := TG_ARGV[0];
  v_link := TG_ARGV[1];

  IF TG_TABLE_NAME = 'preorder_inquiries' THEN
    v_name := NEW.name;

    IF COALESCE(NEW.is_custom_request, false) THEN
      v_vehicle_title := trim(concat_ws(' ',
        NULLIF(NEW.requested_year, ''),
        NULLIF(NEW.requested_make, ''),
        NULLIF(NEW.requested_model, '')
      ));
      IF v_vehicle_title = '' THEN
        v_vehicle_title := 'Custom vehicle request';
      END IF;

      v_specs := COALESCE(NEW.requested_specs, '{}'::jsonb);
      v_budget := CASE
        WHEN NEW.budget_min IS NOT NULL AND NEW.budget_max IS NOT NULL THEN
          'GHS ' || to_char(NEW.budget_min, 'FM999,999') || ' – GHS ' || to_char(NEW.budget_max, 'FM999,999')
        WHEN NEW.budget_max IS NOT NULL THEN
          'Up to GHS ' || to_char(NEW.budget_max, 'FM999,999')
        WHEN NEW.budget_min IS NOT NULL THEN
          'From GHS ' || to_char(NEW.budget_min, 'FM999,999')
        ELSE 'Budget not specified'
      END;

      v_title := 'Custom vehicle request: ' || v_vehicle_title;
      v_message := v_name || ' · ' || v_vehicle_title || ' · ' || v_budget
        || COALESCE(' · Ref ' || NEW.reference_code, '');
      v_link := '/platform/leads/preorder/' || NEW.id::text;

      v_metadata := jsonb_build_object(
        'isCustomRequest', true,
        'referenceCode', NEW.reference_code,
        'customer', jsonb_build_object(
          'name', NEW.name,
          'email', NEW.email,
          'phone', NEW.phone,
          'message', NEW.message
        ),
        'requested', jsonb_build_object(
          'make', NEW.requested_make,
          'model', NEW.requested_model,
          'year', NEW.requested_year,
          'specs', v_specs,
          'budgetMinGhs', NEW.budget_min,
          'budgetMaxGhs', NEW.budget_max
        ),
        'paymentStatus', COALESCE(NEW.payment_status, 'pending')
      );

    ELSE
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
    END IF;

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
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'notify_admin_inquiry failed for % id=%: %', TG_TABLE_NAME, NEW.id, SQLERRM;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_preorder ON preorder_inquiries;
CREATE TRIGGER trg_notify_preorder
  AFTER INSERT ON preorder_inquiries
  FOR EACH ROW EXECUTE FUNCTION notify_admin_inquiry('preorder', '/platform/leads?tab=preorder');
