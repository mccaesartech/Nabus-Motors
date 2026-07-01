-- Soft-delete customers: hide from active list while preserving order history.

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_profiles_deleted_at ON profiles (deleted_at)
  WHERE deleted_at IS NOT NULL;

-- Track deleted contact-only customers (no profile row).
CREATE TABLE IF NOT EXISTS deleted_customer_emails (
  email TEXT PRIMARY KEY,
  deleted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_by TEXT
);

CREATE INDEX IF NOT EXISTS idx_deleted_customer_emails_deleted_at
  ON deleted_customer_emails (deleted_at DESC);
