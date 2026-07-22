export const MOVEMENT_DIRECTIONS = ["in", "out"] as const;
export type MovementDirection = (typeof MOVEMENT_DIRECTIONS)[number];

export const MOVEMENT_ASSET_TYPES = [
  "vehicle",
  "part",
  "expense",
  "sale",
  "preorder",
  "order",
] as const;
export type MovementAssetType = (typeof MOVEMENT_ASSET_TYPES)[number];

export const MOVEMENT_TYPES = [
  "vehicle_received",
  "vehicle_sold",
  "sale_completed",
  "part_stock_in",
  "part_stock_out",
  "order_confirmed",
  "preorder_deposit",
  "expense_recorded",
] as const;
export type MovementType = (typeof MOVEMENT_TYPES)[number];

export type InventoryMovementRow = {
  id: string;
  occurred_at: string;
  direction: MovementDirection;
  asset_type: MovementAssetType;
  movement_type: string;
  description: string;
  quantity: number;
  amount_usd: number;
  asset_id: string | null;
  reference_type: string | null;
  reference_id: string | null;
  metadata: Record<string, unknown>;
  source: string;
  created_by_user_id: string | null;
  created_by_name: string | null;
  created_at: string;
};

export type RecordMovementInput = {
  occurredAt?: string | Date;
  direction: MovementDirection;
  assetType: MovementAssetType;
  movementType: MovementType | string;
  description: string;
  quantity?: number;
  amountUsd?: number;
  assetId?: string | null;
  referenceType?: string | null;
  referenceId?: string | null;
  metadata?: Record<string, unknown>;
  source?: "system" | "backfill" | "manual";
  auth?: {
    userId?: string | null;
    name?: string | null;
  } | null;
};

export type MovementPeriod = "day" | "week" | "month" | "year" | "range";

export type MovementSummary = {
  totalInUsd: number;
  totalOutUsd: number;
  netUsd: number;
  unitsIn: number;
  unitsOut: number;
  count: number;
};

export type MovementBucket = MovementSummary & {
  bucketKey: string;
  bucketLabel: string;
  periodStart: string;
  periodEnd: string;
};
