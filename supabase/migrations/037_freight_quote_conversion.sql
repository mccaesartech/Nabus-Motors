-- Link freight quotes to converted shipments and track converted status.

ALTER TABLE freight_quote_requests
  ADD COLUMN IF NOT EXISTS converted_shipment_id UUID REFERENCES shipment_tracking(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_freight_quotes_converted_shipment
  ON freight_quote_requests(converted_shipment_id)
  WHERE converted_shipment_id IS NOT NULL;

ALTER TABLE freight_quote_requests
  DROP CONSTRAINT IF EXISTS freight_quote_requests_status_check;

ALTER TABLE freight_quote_requests
  ADD CONSTRAINT freight_quote_requests_status_check
  CHECK (status IN ('new', 'contacted', 'quoted', 'accepted', 'converted', 'closed', 'cancelled'));

-- Backfill quotes already converted via shipment_tracking.reference_id
UPDATE freight_quote_requests q
SET
  converted_shipment_id = s.id,
  status = 'converted',
  updated_at = NOW()
FROM shipment_tracking s
WHERE s.reference_type = 'freight'
  AND s.reference_id IS NOT NULL
  AND s.reference_id = q.id
  AND q.converted_shipment_id IS NULL;
