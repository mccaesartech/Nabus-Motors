-- Store manager edit proposals separately from live inventory so rejection
-- does not hide or corrupt published listings.

ALTER TABLE vehicles
  ADD COLUMN IF NOT EXISTS pending_changes JSONB;

COMMENT ON COLUMN vehicles.pending_changes IS
  'Proposed field updates awaiting owner approval. NULL for new listings pending first publish.';

-- Public site: approved listings, plus live rows with pending edits (original data stays visible).
DROP POLICY IF EXISTS "Vehicles are publicly readable" ON vehicles;
CREATE POLICY "Vehicles are publicly readable"
  ON vehicles FOR SELECT
  USING (
    status IN ('available', 'pre_order')
    AND (
      approval_status = 'approved'
      OR (approval_status = 'pending_approval' AND pending_changes IS NOT NULL)
    )
  );
