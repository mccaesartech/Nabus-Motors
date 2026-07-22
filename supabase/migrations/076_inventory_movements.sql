-- Inventory & business movement ledger — trace stock and financial flows over time.
-- Apply via Supabase CLI or SQL editor if not auto-deployed.

CREATE TABLE IF NOT EXISTS inventory_movements (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  direction TEXT NOT NULL CHECK (direction IN ('in', 'out')),
  asset_type TEXT NOT NULL CHECK (
    asset_type IN ('vehicle', 'part', 'expense', 'sale', 'preorder', 'order')
  ),
  movement_type TEXT NOT NULL,
  description TEXT NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  amount_usd INTEGER NOT NULL DEFAULT 0,
  asset_id UUID,
  reference_type TEXT,
  reference_id UUID,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  source TEXT NOT NULL DEFAULT 'system' CHECK (source IN ('system', 'backfill', 'manual')),
  created_by_user_id UUID REFERENCES platform_users(id) ON DELETE SET NULL,
  created_by_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_inventory_movements_dedup
  ON inventory_movements (movement_type, reference_type, reference_id)
  WHERE reference_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_inventory_movements_occurred_at
  ON inventory_movements (occurred_at DESC);

CREATE INDEX IF NOT EXISTS idx_inventory_movements_asset_type
  ON inventory_movements (asset_type);

CREATE INDEX IF NOT EXISTS idx_inventory_movements_direction
  ON inventory_movements (direction);

CREATE INDEX IF NOT EXISTS idx_inventory_movements_movement_type
  ON inventory_movements (movement_type);

ALTER TABLE inventory_movements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role manages inventory_movements" ON inventory_movements;
CREATE POLICY "Service role manages inventory_movements"
  ON inventory_movements FOR ALL USING (false) WITH CHECK (false);
