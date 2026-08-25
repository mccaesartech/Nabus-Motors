import type { SupabaseClient } from "@supabase/supabase-js";
import type { PlatformAuthContext } from "@/lib/admin/auth";
import { enqueueAuditLog } from "@/lib/audit/write";
import type { RecordMovementInput } from "./types";
import {
  SCHEMA_CAPS,
  isMissingRelationError,
  isSchemaMissing,
  markSchemaMissing,
  markSchemaPresent,
} from "@/lib/observability/schema-capability";
import { reportSchemaIssue } from "@/lib/observability/schema-issue";

function toIso(value: string | Date | undefined): string {
  if (!value) return new Date().toISOString();
  if (value instanceof Date) return value.toISOString();
  return value;
}

export async function recordInventoryMovement(
  supabase: SupabaseClient,
  input: RecordMovementInput
): Promise<{ ok: boolean; id?: string; skipped?: boolean; error?: string }> {
  if (isSchemaMissing(SCHEMA_CAPS.inventoryMovements)) {
    return { ok: false, skipped: true, error: "inventory_movements table missing — apply migration 086" };
  }

  const referenceId = input.referenceId ?? null;
  const referenceType = input.referenceType ?? null;
  const movementType = input.movementType;

  if (referenceId && referenceType) {
    const { data: existing, error: existingError } = await supabase
      .from("inventory_movements")
      .select("id")
      .eq("movement_type", movementType)
      .eq("reference_type", referenceType)
      .eq("reference_id", referenceId)
      .maybeSingle();

    if (existingError && isMissingRelationError(existingError.message, "inventory_movements")) {
      reportSchemaIssue({
        table: "inventory_movements",
        migration: "076_inventory_movements.sql / 086_postgres_error_clearance.sql",
        source: "recordInventoryMovement.exists",
        message: existingError.message,
      });
      markSchemaMissing(SCHEMA_CAPS.inventoryMovements);
      return { ok: false, skipped: true, error: "inventory_movements table missing — apply migration 086" };
    }

    if (existing?.id) {
      return { ok: true, id: existing.id, skipped: true };
    }
  }

  const row = {
    occurred_at: toIso(input.occurredAt),
    direction: input.direction,
    asset_type: input.assetType,
    movement_type: movementType,
    description: input.description,
    quantity: Math.max(0, Math.round(Number(input.quantity ?? 1))),
    amount_usd: Math.max(0, Math.round(Number(input.amountUsd ?? 0))),
    asset_id: input.assetId ?? null,
    reference_type: referenceType,
    reference_id: referenceId,
    metadata: input.metadata ?? {},
    source: input.source ?? "system",
    created_by_user_id: input.auth?.userId ?? null,
    created_by_name: input.auth?.name ?? null,
  };

  const { data, error } = await supabase
    .from("inventory_movements")
    .insert(row)
    .select("id")
    .single();

  if (error) {
    if (isMissingRelationError(error.message, "inventory_movements")) {
      reportSchemaIssue({
        table: "inventory_movements",
        migration: "076_inventory_movements.sql / 086_postgres_error_clearance.sql",
        source: "recordInventoryMovement.insert",
        message: error.message,
      });
      markSchemaMissing(SCHEMA_CAPS.inventoryMovements);
      return { ok: false, skipped: true, error: "inventory_movements table missing — apply migration 086" };
    }
    if (error.code === "23505") {
      return { ok: true, skipped: true };
    }
    console.error("[recordInventoryMovement]", error.message);
    return { ok: false, error: error.message };
  }

  markSchemaPresent(SCHEMA_CAPS.inventoryMovements);
  enqueueAuditLog({
    action: "inventory_movement",
    success: true,
    actorUserId: input.auth?.userId ?? null,
    actorName: input.auth?.name ?? null,
    targetType: input.assetType,
    targetId: input.assetId ?? input.referenceId ?? null,
    targetName: input.description?.slice(0, 300) ?? null,
    metadata: {
      movement_type: movementType,
      direction: input.direction,
    },
  });
  return { ok: true, id: data.id as string };
}

export function authFromContext(auth: PlatformAuthContext | null | undefined) {
  if (!auth) return null;
  return {
    userId: auth.type === "user" ? auth.userId ?? null : null,
    name: auth.name ?? null,
  };
}

export async function recordVehicleReceived(
  supabase: SupabaseClient,
  vehicle: {
    id: string;
    year: number;
    make: string;
    model: string;
    price?: number | null;
    created_at?: string | null;
  },
  auth?: PlatformAuthContext | null,
  options?: {
    quantity?: number;
    /** When set, allows multiple receive movements for the same listing (stock top-ups). */
    referenceId?: string | null;
    description?: string;
  }
) {
  const label = `${vehicle.year} ${vehicle.make} ${vehicle.model}`;
  const quantity = Math.max(1, Math.round(Number(options?.quantity ?? 1)));
  return recordInventoryMovement(supabase, {
    occurredAt: vehicle.created_at ?? undefined,
    direction: "in",
    assetType: "vehicle",
    movementType: "vehicle_received",
    description:
      options?.description ??
      (quantity > 1
        ? `Vehicles added to inventory — ${label} ×${quantity}`
        : `Vehicle added to inventory — ${label}`),
    quantity,
    amountUsd: Number(vehicle.price) || 0,
    assetId: vehicle.id,
    referenceType: "vehicles",
    referenceId: options?.referenceId ?? vehicle.id,
    metadata: { label, units: quantity },
    auth: authFromContext(auth),
  });
}

export async function recordVehicleSold(
  supabase: SupabaseClient,
  vehicle: {
    id: string;
    year: number;
    make: string;
    model: string;
    price?: number | null;
  },
  options?: {
    salePrice?: number | null;
    saleId?: string | null;
    occurredAt?: string;
    auth?: PlatformAuthContext | null;
    movementType?: "vehicle_sold" | "sale_completed";
    quantity?: number;
    /**
     * Override dedupe key. Multi-unit listings need a unique id per unit sold
     * so each decrement is recorded (default vehicle.id would skip repeats).
     */
    referenceId?: string | null;
  }
) {
  const label = `${vehicle.year} ${vehicle.make} ${vehicle.model}`;
  const amount = Number(options?.salePrice ?? vehicle.price) || 0;
  const movementType = options?.movementType ?? "vehicle_sold";
  const isSale = movementType === "sale_completed";
  const quantity = Math.max(1, Math.round(Number(options?.quantity ?? 1)));

  return recordInventoryMovement(supabase, {
    occurredAt: options?.occurredAt,
    direction: isSale ? "in" : "out",
    assetType: isSale ? "sale" : "vehicle",
    movementType,
    description: isSale
      ? `Sale completed — ${label} ($${amount.toLocaleString()})`
      : `Vehicle sold / dispatched — ${label}`,
    quantity,
    amountUsd: amount,
    assetId: vehicle.id,
    referenceType: options?.saleId ? "sales" : "vehicles",
    referenceId: options?.referenceId ?? options?.saleId ?? vehicle.id,
    metadata: { label, vehicle_id: vehicle.id, units: quantity },
    auth: authFromContext(options?.auth),
  });
}

export async function recordPartStockChange(
  supabase: SupabaseClient,
  part: { id: string; name: string; sku?: string | null; price_usd?: number | null },
  delta: number,
  auth?: PlatformAuthContext | null
) {
  if (delta === 0) return { ok: true, skipped: true };

  const quantity = Math.abs(delta);
  const unitPrice = Number(part.price_usd) || 0;
  const direction = delta > 0 ? "in" : "out";
  const movementType = delta > 0 ? "part_stock_in" : "part_stock_out";
  const sku = part.sku ? ` (${part.sku})` : "";

  return recordInventoryMovement(supabase, {
    direction,
    assetType: "part",
    movementType,
    description: `Parts stock ${direction === "in" ? "in" : "out"} — ${part.name}${sku} ×${quantity}`,
    quantity,
    amountUsd: unitPrice * quantity,
    assetId: part.id,
    referenceType: "parts",
    referenceId: `${part.id}:${Date.now()}`,
    metadata: { delta, part_name: part.name },
    auth: authFromContext(auth),
  });
}

export async function recordExpenseMovement(
  supabase: SupabaseClient,
  expense: {
    id: string;
    description: string;
    amount_usd: number;
    expense_date: string;
  },
  auth?: PlatformAuthContext | null
) {
  return recordInventoryMovement(supabase, {
    occurredAt: `${expense.expense_date}T12:00:00.000Z`,
    direction: "out",
    assetType: "expense",
    movementType: "expense_recorded",
    description: `Expense — ${expense.description}`,
    quantity: 0,
    amountUsd: Number(expense.amount_usd) || 0,
    assetId: expense.id,
    referenceType: "expenses",
    referenceId: expense.id,
    auth: authFromContext(auth),
  });
}

export async function recordOrderConfirmed(
  supabase: SupabaseClient,
  order: {
    id: string;
    name: string;
    totalUsd: number;
    confirmedAt?: string | null;
    partCount?: number;
    vehicleCount?: number;
  },
  auth?: PlatformAuthContext | null
) {
  const items = (order.partCount ?? 0) + (order.vehicleCount ?? 0);
  return recordInventoryMovement(supabase, {
    occurredAt: order.confirmedAt ?? undefined,
    direction: "in",
    assetType: "order",
    movementType: "order_confirmed",
    description: `Order confirmed — ${order.name} (${items} item${items === 1 ? "" : "s"})`,
    quantity: items || 1,
    amountUsd: Number(order.totalUsd) || 0,
    assetId: order.id,
    referenceType: "parts_orders",
    referenceId: order.id,
    auth: authFromContext(auth),
  });
}

export async function recordPreorderDeposit(
  supabase: SupabaseClient,
  preorder: {
    id: string;
    name: string;
    down_payment_usd: number;
    created_at?: string | null;
  },
  auth?: PlatformAuthContext | null
) {
  return recordInventoryMovement(supabase, {
    occurredAt: preorder.created_at ?? undefined,
    direction: "in",
    assetType: "preorder",
    movementType: "preorder_deposit",
    description: `Pre-order deposit — ${preorder.name}`,
    quantity: 1,
    amountUsd: Number(preorder.down_payment_usd) || 0,
    assetId: preorder.id,
    referenceType: "preorder_inquiries",
    referenceId: preorder.id,
    auth: authFromContext(auth),
  });
}
