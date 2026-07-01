-- Support ticket assignment on customer conversations (claim, handoff, reopen)
-- REQUIRES: 019_customer_conversations.sql completed successfully first.

ALTER TABLE customer_conversations
  ADD COLUMN IF NOT EXISTS preorder_id UUID REFERENCES preorder_inquiries(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS assigned_to_user_id UUID REFERENCES platform_users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS assigned_to_is_owner BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS claimed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS closed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS closed_by_user_id UUID REFERENCES platform_users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS closed_by_is_owner BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS resolution_note TEXT;

CREATE INDEX IF NOT EXISTS idx_customer_conversations_queue
  ON customer_conversations(status, updated_at DESC)
  WHERE status IN ('open', 'available');

CREATE INDEX IF NOT EXISTS idx_customer_conversations_assigned
  ON customer_conversations(assigned_to_user_id, assigned_to_is_owner, status);

CREATE INDEX IF NOT EXISTS idx_customer_conversations_preorder
  ON customer_conversations(preorder_id)
  WHERE preorder_id IS NOT NULL;

-- Migrate legacy statuses into ticket workflow
ALTER TABLE customer_conversations
  DROP CONSTRAINT IF EXISTS customer_conversations_status_check;

UPDATE customer_conversations
SET status = 'open'
WHERE status = 'new';

UPDATE customer_conversations
SET status = 'claimed', claimed_at = COALESCE(claimed_at, updated_at)
WHERE status = 'replied';

ALTER TABLE customer_conversations
  ADD CONSTRAINT customer_conversations_status_check
  CHECK (status IN ('open', 'claimed', 'closed', 'available'));

-- Atomic first-accept claim (prevents race when two staff click Accept)
CREATE OR REPLACE FUNCTION public.claim_support_ticket(
  p_ticket_id UUID,
  p_claimer_user_id UUID,
  p_claimer_is_owner BOOLEAN
)
RETURNS SETOF customer_conversations
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  UPDATE customer_conversations
  SET
    status = 'claimed',
    assigned_to_user_id = CASE WHEN p_claimer_is_owner THEN NULL ELSE p_claimer_user_id END,
    assigned_to_is_owner = p_claimer_is_owner,
    claimed_at = NOW(),
    updated_at = NOW(),
    closed_at = NULL,
    closed_by_user_id = NULL,
    closed_by_is_owner = false,
    resolution_note = NULL
  WHERE id = p_ticket_id
    AND status IN ('open', 'available')
    AND assigned_to_user_id IS NULL
    AND assigned_to_is_owner = false
  RETURNING *;
END;
$$;

-- Reopen a closed ticket back to the queue
CREATE OR REPLACE FUNCTION public.reopen_support_ticket(p_ticket_id UUID)
RETURNS SETOF customer_conversations
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  UPDATE customer_conversations
  SET
    status = 'available',
    assigned_to_user_id = NULL,
    assigned_to_is_owner = false,
    claimed_at = NULL,
    closed_at = NULL,
    closed_by_user_id = NULL,
    closed_by_is_owner = false,
    resolution_note = NULL,
    updated_at = NOW()
  WHERE id = p_ticket_id
    AND status = 'closed'
  RETURNING *;
END;
$$;
