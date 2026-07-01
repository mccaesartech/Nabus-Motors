-- Admin notification center: persisted notifications + triggers on new inquiries

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS admin_notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  link TEXT,
  source_table TEXT,
  source_id UUID,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_admin_notifications_unread
  ON admin_notifications (created_at DESC)
  WHERE read_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_admin_notifications_created
  ON admin_notifications (created_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS idx_admin_notifications_source
  ON admin_notifications (source_table, source_id)
  WHERE source_id IS NOT NULL;

ALTER TABLE admin_notifications ENABLE ROW LEVEL SECURITY;

-- Service role bypasses RLS; block anon access
DROP POLICY IF EXISTS "No public access to admin notifications" ON admin_notifications;
CREATE POLICY "No public access to admin notifications"
  ON admin_notifications FOR ALL USING (false) WITH CHECK (false);

-- ─── Trigger helper ───────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION notify_admin_inquiry()
RETURNS TRIGGER AS $$
DECLARE
  v_type TEXT;
  v_title TEXT;
  v_message TEXT;
  v_link TEXT;
  v_name TEXT;
BEGIN
  v_type := TG_ARGV[0];
  v_link := TG_ARGV[1];

  IF TG_TABLE_NAME = 'preorder_inquiries' THEN
    v_name := NEW.name;
    v_title := 'New pre-order inquiry';
    v_message := v_name || ' submitted a pre-order request';
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

  INSERT INTO admin_notifications (type, title, message, link, source_table, source_id)
  VALUES (v_type, v_title, v_message, v_link, TG_TABLE_NAME, NEW.id)
  ON CONFLICT (source_table, source_id) WHERE source_id IS NOT NULL DO NOTHING;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ─── Inquiry triggers ─────────────────────────────────────────────────────────
DROP TRIGGER IF EXISTS trg_notify_preorder ON preorder_inquiries;
CREATE TRIGGER trg_notify_preorder
  AFTER INSERT ON preorder_inquiries
  FOR EACH ROW EXECUTE FUNCTION notify_admin_inquiry('preorder', '/platform/leads?tab=preorder');

DROP TRIGGER IF EXISTS trg_notify_vehicle_inquiry ON vehicle_inquiries;
CREATE TRIGGER trg_notify_vehicle_inquiry
  AFTER INSERT ON vehicle_inquiries
  FOR EACH ROW EXECUTE FUNCTION notify_admin_inquiry('vehicle', '/platform/leads?tab=vehicle');

DROP TRIGGER IF EXISTS trg_notify_contact ON contact_inquiries;
CREATE TRIGGER trg_notify_contact
  AFTER INSERT ON contact_inquiries
  FOR EACH ROW EXECUTE FUNCTION notify_admin_inquiry('contact', '/platform/leads?tab=contact');

DROP TRIGGER IF EXISTS trg_notify_finance ON finance_applications;
CREATE TRIGGER trg_notify_finance
  AFTER INSERT ON finance_applications
  FOR EACH ROW EXECUTE FUNCTION notify_admin_inquiry('finance', '/platform/leads?tab=finance');

DROP TRIGGER IF EXISTS trg_notify_appraisal ON appraisal_requests;
CREATE TRIGGER trg_notify_appraisal
  AFTER INSERT ON appraisal_requests
  FOR EACH ROW EXECUTE FUNCTION notify_admin_inquiry('appraisal', '/platform/leads?tab=appraisal');

-- ─── Backfill open inquiries as notifications ─────────────────────────────────
INSERT INTO admin_notifications (type, title, message, link, source_table, source_id, created_at)
SELECT
  'preorder',
  'New pre-order inquiry',
  p.name || ' submitted a pre-order request',
  '/platform/leads?tab=preorder',
  'preorder_inquiries',
  p.id,
  p.created_at
FROM preorder_inquiries p
WHERE p.status IN ('new', 'pending')
ON CONFLICT (source_table, source_id) WHERE source_id IS NOT NULL DO NOTHING;

INSERT INTO admin_notifications (type, title, message, link, source_table, source_id, created_at)
SELECT
  'vehicle',
  'New vehicle inquiry',
  v.name || ' inquired about ' || COALESCE(v.vehicle_name, v.vehicle_slug, 'a vehicle'),
  '/platform/leads?tab=vehicle',
  'vehicle_inquiries',
  v.id,
  v.created_at
FROM vehicle_inquiries v
WHERE v.status IN ('new', 'pending')
ON CONFLICT (source_table, source_id) WHERE source_id IS NOT NULL DO NOTHING;

INSERT INTO admin_notifications (type, title, message, link, source_table, source_id, created_at)
SELECT
  'contact',
  'New contact message',
  c.name || ': ' || LEFT(COALESCE(c.subject, c.message, ''), 80),
  '/platform/leads?tab=contact',
  'contact_inquiries',
  c.id,
  c.created_at
FROM contact_inquiries c
WHERE c.status IN ('new', 'pending')
ON CONFLICT (source_table, source_id) WHERE source_id IS NOT NULL DO NOTHING;

INSERT INTO admin_notifications (type, title, message, link, source_table, source_id, created_at)
SELECT
  'finance',
  'New finance application',
  TRIM(f.first_name || ' ' || f.last_name) || ' applied for financing',
  '/platform/leads?tab=finance',
  'finance_applications',
  f.id,
  f.created_at
FROM finance_applications f
WHERE f.status IN ('new', 'pending')
ON CONFLICT (source_table, source_id) WHERE source_id IS NOT NULL DO NOTHING;

INSERT INTO admin_notifications (type, title, message, link, source_table, source_id, created_at)
SELECT
  'appraisal',
  'New appraisal request',
  a.seller_name || ' wants to sell a ' || a.year || ' ' || a.make || ' ' || a.model,
  '/platform/leads?tab=appraisal',
  'appraisal_requests',
  a.id,
  a.created_at
FROM appraisal_requests a
WHERE a.status IN ('new', 'pending')
ON CONFLICT (source_table, source_id) WHERE source_id IS NOT NULL DO NOTHING;
