-- Freight quote reference codes and customer account linking.

ALTER TABLE freight_quote_requests
  ADD COLUMN IF NOT EXISTS reference_code TEXT,
  ADD COLUMN IF NOT EXISTS customer_registration_id TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_freight_quotes_reference_code
  ON freight_quote_requests(reference_code)
  WHERE reference_code IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_freight_quotes_user_id
  ON freight_quote_requests(user_id)
  WHERE user_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.generate_freight_reference_code()
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
  year_part TEXT := to_char(NOW(), 'YYYY');
  suffix TEXT;
  candidate TEXT;
  attempts INTEGER := 0;
BEGIN
  LOOP
    suffix := upper(substr(md5(random()::text || clock_timestamp()::text), 1, 6));
    candidate := 'FQ-' || year_part || '-' || suffix;
    IF NOT EXISTS (
      SELECT 1 FROM freight_quote_requests WHERE reference_code = candidate
    ) THEN
      RETURN candidate;
    END IF;
    attempts := attempts + 1;
    IF attempts > 20 THEN
      RAISE EXCEPTION 'Could not generate unique freight reference code';
    END IF;
  END LOOP;
END;
$$;

-- Backfill reference codes for existing quotes
UPDATE freight_quote_requests
SET reference_code = generate_freight_reference_code()
WHERE reference_code IS NULL;
