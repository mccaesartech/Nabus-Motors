-- Pre-order payment workflow (25% down payment tracking)

ALTER TABLE preorder_inquiries
  ADD COLUMN IF NOT EXISTS payment_status TEXT DEFAULT 'pending';

ALTER TABLE preorder_inquiries
  DROP CONSTRAINT IF EXISTS preorder_inquiries_payment_status_check;

ALTER TABLE preorder_inquiries
  ADD CONSTRAINT preorder_inquiries_payment_status_check
  CHECK (payment_status IN ('pending', 'down_payment_paid', 'completed', 'cancelled'));

CREATE INDEX IF NOT EXISTS idx_preorder_inquiries_payment_status
  ON preorder_inquiries(payment_status);

-- Ensure denormalized vehicle columns exist (from 006) for older databases
ALTER TABLE preorder_inquiries
  ADD COLUMN IF NOT EXISTS vehicle_slug TEXT,
  ADD COLUMN IF NOT EXISTS vehicle_title TEXT,
  ADD COLUMN IF NOT EXISTS vehicle_price_usd INTEGER;
