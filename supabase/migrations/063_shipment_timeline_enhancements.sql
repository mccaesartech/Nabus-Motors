-- Extended shipment milestone metadata for customer tracking

ALTER TABLE shipment_timeline_events
  ADD COLUMN IF NOT EXISTS estimated_completion TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS admin_comment TEXT,
  ADD COLUMN IF NOT EXISTS attachment_urls TEXT[] NOT NULL DEFAULT '{}';

COMMENT ON COLUMN shipment_timeline_events.admin_comment IS
  'Internal or customer-facing note from admin when updating this milestone';
