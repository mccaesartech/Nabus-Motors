-- Sales module: quotations, pre-order linkage, customer contact fields

ALTER TABLE sales
  ADD COLUMN IF NOT EXISTS valid_until DATE,
  ADD COLUMN IF NOT EXISTS preorder_inquiry_id UUID REFERENCES preorder_inquiries(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS customer_name TEXT,
  ADD COLUMN IF NOT EXISTS customer_email TEXT;

ALTER TABLE sales ALTER COLUMN status SET DEFAULT 'draft';

UPDATE sales SET status = 'draft' WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_sales_preorder ON sales(preorder_inquiry_id);
CREATE INDEX IF NOT EXISTS idx_sales_valid_until ON sales(valid_until);
