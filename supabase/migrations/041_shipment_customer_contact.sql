-- Store customer WhatsApp contact on shipment records (copied from quote at conversion).

ALTER TABLE shipment_tracking
  ADD COLUMN IF NOT EXISTS customer_phone TEXT,
  ADD COLUMN IF NOT EXISTS whatsapp_opt_in BOOLEAN DEFAULT NULL;

-- Backfill from linked freight quotes
UPDATE shipment_tracking s
SET
  customer_phone = COALESCE(s.customer_phone, q.phone),
  whatsapp_opt_in = COALESCE(s.whatsapp_opt_in, q.whatsapp_opt_in)
FROM freight_quote_requests q
WHERE s.reference_type = 'freight'
  AND s.reference_id = q.id
  AND (s.customer_phone IS NULL OR s.whatsapp_opt_in IS NULL);

-- Backfill from linked pre-orders
UPDATE shipment_tracking s
SET
  customer_phone = COALESCE(s.customer_phone, p.phone),
  whatsapp_opt_in = COALESCE(s.whatsapp_opt_in, p.whatsapp_opt_in)
FROM preorder_inquiries p
WHERE s.reference_type = 'preorder'
  AND s.reference_id = p.id
  AND (s.customer_phone IS NULL OR s.whatsapp_opt_in IS NULL);

-- Default Ghana mobile numbers to WhatsApp opt-in when still unset
UPDATE shipment_tracking
SET whatsapp_opt_in = TRUE
WHERE whatsapp_opt_in IS NULL
  AND customer_phone IS NOT NULL
  AND customer_phone ~ '^(\+?233|0)(20|23|24|25|26|27|28|50|53|54|55|56|57|59)';
