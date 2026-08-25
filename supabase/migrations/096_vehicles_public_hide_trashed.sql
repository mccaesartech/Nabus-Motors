-- Soft-deleted / trashed vehicles must never be readable by the anon key.
-- App queries already filter deleted_at, but RLS is the authoritative public gate.
-- Soft-delete leaves status as available/pre_order, so the prior policy still matched.

DROP POLICY IF EXISTS "Vehicles are publicly readable" ON vehicles;
CREATE POLICY "Vehicles are publicly readable"
  ON vehicles FOR SELECT
  USING (
    deleted_at IS NULL
    AND status IN ('available', 'pre_order')
    AND (
      approval_status = 'approved'
      OR (
        approval_status IN ('pending_approval', 'rejected')
        AND pending_changes IS NOT NULL
      )
    )
  );
