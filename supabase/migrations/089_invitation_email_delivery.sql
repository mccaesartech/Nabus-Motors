-- Durable Resend delivery state for platform invitations.

ALTER TABLE platform_user_invites
  ADD COLUMN IF NOT EXISTS email_status TEXT NOT NULL DEFAULT 'PENDING',
  ADD COLUMN IF NOT EXISTS sent_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS provider_message_id TEXT,
  ADD COLUMN IF NOT EXISTS provider_error TEXT;

ALTER TABLE platform_user_invites
  DROP CONSTRAINT IF EXISTS platform_user_invites_email_status_check;

ALTER TABLE platform_user_invites
  ADD CONSTRAINT platform_user_invites_email_status_check
  CHECK (email_status IN ('PENDING', 'SENT', 'FAILED'));

CREATE INDEX IF NOT EXISTS idx_platform_user_invites_email_status
  ON platform_user_invites(email_status, created_at DESC);

COMMENT ON COLUMN platform_user_invites.email_status IS
  'Invitation email delivery state: PENDING, SENT, or FAILED.';
COMMENT ON COLUMN platform_user_invites.sent_at IS
  'Timestamp when Resend accepted the invitation email.';
COMMENT ON COLUMN platform_user_invites.provider_message_id IS
  'Resend provider message ID.';
COMMENT ON COLUMN platform_user_invites.provider_error IS
  'Last safe provider error; a failed email never cancels the invitation.';
