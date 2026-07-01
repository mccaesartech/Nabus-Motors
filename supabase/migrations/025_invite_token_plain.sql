-- Plain invite token for owner-only link retrieval (validation still uses token_hash; RLS blocks client access)
ALTER TABLE platform_user_invites
  ADD COLUMN IF NOT EXISTS token_plain TEXT;
