-- Rejected edit proposals keep pending_changes so owners can re-approve.
-- Live approved rows with rejected edits must stay visible on the public site.

DROP POLICY IF EXISTS "Vehicles are publicly readable" ON vehicles;
CREATE POLICY "Vehicles are publicly readable"
  ON vehicles FOR SELECT
  USING (
    status IN ('available', 'pre_order')
    AND (
      approval_status = 'approved'
      OR (
        approval_status IN ('pending_approval', 'rejected')
        AND pending_changes IS NOT NULL
      )
    )
  );
