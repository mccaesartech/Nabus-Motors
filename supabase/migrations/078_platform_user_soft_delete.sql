-- Soft-delete for platform team users (Users & roles → Trash restore).

ALTER TABLE platform_users
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS deleted_by_user_id UUID REFERENCES platform_users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_platform_users_deleted_at
  ON platform_users (deleted_at)
  WHERE deleted_at IS NOT NULL;

-- Free the email for re-invite after soft-delete (keep UNIQUE only for active rows).
ALTER TABLE platform_users DROP CONSTRAINT IF EXISTS platform_users_email_key;
DROP INDEX IF EXISTS platform_users_email_key;

CREATE UNIQUE INDEX IF NOT EXISTS platform_users_email_active_unique
  ON platform_users (lower(email))
  WHERE deleted_at IS NULL;
