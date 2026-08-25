import type { SupabaseClient } from "@supabase/supabase-js";
import type { PlatformAuthContext } from "@/lib/admin/auth";
import { logPlatformActivity } from "@/lib/platform/activity";
import {
  maybeNotifyVehicleStockAction,
  refreshFleetLowStockAlert,
} from "@/lib/platform/vehicle-stock-notifications";
import { listingUnitCount, stockGroupKey } from "@/lib/vehicles/low-stock";
import {
  resolveStatusAfterSoldTransition,
  resolveUnitSoldFromQuantity,
  type UnitSoldTransition,
} from "@/lib/vehicles/stock-sold";

export type VehicleStockIdentity = {
  id: string;
  slug?: string | null;
  make: string;
  model: string;
  year: number;
  /** Current units on this listing (migration 082). Missing → treated as 1. */
  stock_quantity?: number | null;
  status?: string | null;
};

export type { UnitSoldTransition };

export type SoldStatusTransition = {
  status: "available" | "sold" | "pre_order";
  autoPreOrder: boolean;
  availableSiblings: number;
  unitDecremented: boolean;
  stock_quantity: number;
  remainingInGroup: number;
};

export {
  stockGroupKey,
  resolveStatusAfterSoldTransition,
  resolveUnitSoldFromQuantity,
};

/** Available units on other listings of the same make/model/year (sums stock_quantity). */
export async function countAvailableSiblings(
  supabase: SupabaseClient,
  vehicle: Pick<VehicleStockIdentity, "id" | "make" | "model" | "year">
): Promise<number> {
  const withQty = await supabase
    .from("vehicles")
    .select("id, stock_quantity")
    .eq("make", vehicle.make)
    .eq("model", vehicle.model)
    .eq("year", vehicle.year)
    .eq("status", "available")
    .is("deleted_at", null)
    .neq("id", vehicle.id);

  if (!withQty.error) {
    return (withQty.data ?? []).reduce(
      (sum, row) => sum + listingUnitCount(row as { stock_quantity?: number | null }),
      0
    );
  }

  // Retry without deleted_at if that column is absent.
  if (/deleted_at/i.test(withQty.error.message)) {
    const noTrash = await supabase
      .from("vehicles")
      .select("id, stock_quantity")
      .eq("make", vehicle.make)
      .eq("model", vehicle.model)
      .eq("year", vehicle.year)
      .eq("status", "available")
      .neq("id", vehicle.id);
    if (!noTrash.error) {
      return (noTrash.data ?? []).reduce(
        (sum, row) => sum + listingUnitCount(row as { stock_quantity?: number | null }),
        0
      );
    }
  }

  // stock_quantity missing (migration 082) → legacy one-row-per-unit count.
  const useDeletedAt = !/deleted_at/i.test(withQty.error.message);
  let countQuery = supabase
    .from("vehicles")
    .select("id", { count: "exact", head: true })
    .eq("make", vehicle.make)
    .eq("model", vehicle.model)
    .eq("year", vehicle.year)
    .eq("status", "available")
    .neq("id", vehicle.id);
  if (useDeletedAt) {
    countQuery = countQuery.is("deleted_at", null);
  }
  let { count, error: countError } = await countQuery;

  if (countError && /deleted_at/i.test(countError.message)) {
    const retry = await supabase
      .from("vehicles")
      .select("id", { count: "exact", head: true })
      .eq("make", vehicle.make)
      .eq("model", vehicle.model)
      .eq("year", vehicle.year)
      .eq("status", "available")
      .neq("id", vehicle.id);
    count = retry.count;
    countError = retry.error;
  }

  if (countError) {
    console.error("[stock-automation] countAvailableSiblings:", countError.message);
    return 0;
  }

  return count ?? 0;
}

async function loadStockQuantity(
  supabase: SupabaseClient,
  vehicleId: string,
  fallback?: number | null
): Promise<number> {
  if (fallback !== null && fallback !== undefined) {
    return listingUnitCount({ stock_quantity: fallback });
  }

  const { data, error } = await supabase
    .from("vehicles")
    .select("stock_quantity")
    .eq("id", vehicleId)
    .maybeSingle();

  if (error) {
    // Column missing or other error → legacy one-row-per-unit.
    return 1;
  }

  return listingUnitCount((data as { stock_quantity?: number | null } | null) ?? {});
}

/** Resolve what status + qty to write when one unit is marked sold. */
export async function resolveUnitSoldTransition(
  supabase: SupabaseClient,
  vehicle: VehicleStockIdentity
): Promise<UnitSoldTransition> {
  const availableSiblings = await countAvailableSiblings(supabase, vehicle);
  const currentQuantity = await loadStockQuantity(
    supabase,
    vehicle.id,
    vehicle.stock_quantity
  );
  return resolveUnitSoldFromQuantity(currentQuantity, availableSiblings);
}

/**
 * Apply one-unit sold: decrement stock_quantity when > 1, otherwise sold/pre_order.
 */
export async function applySoldStatusTransition(
  supabase: SupabaseClient,
  vehicle: VehicleStockIdentity,
  options?: {
    auth?: PlatformAuthContext | null;
    source?: string;
  }
): Promise<SoldStatusTransition> {
  const transition = await resolveUnitSoldTransition(supabase, vehicle);

  const { error } = await supabase
    .from("vehicles")
    .update({
      status: transition.status,
      stock_quantity: transition.stock_quantity,
    })
    .eq("id", vehicle.id);

  if (error) {
    // Retry without stock_quantity if the column is not migrated yet.
    if (/stock_quantity/i.test(error.message)) {
      const { error: statusError } = await supabase
        .from("vehicles")
        .update({ status: transition.status })
        .eq("id", vehicle.id);
      if (statusError) {
        console.error("[stock-automation] applySoldStatusTransition:", statusError.message);
        throw new Error(statusError.message);
      }
    } else {
      console.error("[stock-automation] applySoldStatusTransition:", error.message);
      throw new Error(error.message);
    }
  }

  if (transition.autoPreOrder && options?.auth) {
    await logPlatformActivity(options.auth, "vehicle_auto_pre_order", vehicle.slug ?? vehicle.id, {
      id: vehicle.id,
      make: vehicle.make,
      model: vehicle.model,
      year: vehicle.year,
      available_siblings: transition.availableSiblings,
      source: options.source ?? "sold_transition",
    });
  }

  try {
    await maybeNotifyVehicleStockAction(supabase, {
      id: vehicle.id,
      slug: vehicle.slug,
      year: vehicle.year,
      make: vehicle.make,
      model: vehicle.model,
      // Remaining units after this sale (same-listing + siblings).
      availableSiblings: transition.remainingInGroup,
      autoPreOrder: transition.autoPreOrder,
      source: "sold",
      sourceDetail: options?.source ?? "sold_transition",
    });
  } catch (err) {
    console.error("[stock-automation] stock action notify failed:", err);
  }

  try {
    await refreshFleetLowStockAlert(supabase);
  } catch (err) {
    console.error("[stock-automation] fleet low stock notify failed:", err);
  }

  return {
    status: transition.status,
    autoPreOrder: transition.autoPreOrder,
    availableSiblings: transition.availableSiblings,
    unitDecremented: transition.unitDecremented,
    stock_quantity: transition.stock_quantity,
    remainingInGroup: transition.remainingInGroup,
  };
}

/** Resolve sold → available (qty--) / sold / pre_order when admin requests sold. */
export async function resolveRequestedSoldStatus(
  supabase: SupabaseClient,
  vehicle: VehicleStockIdentity
): Promise<"available" | "sold" | "pre_order"> {
  const transition = await resolveUnitSoldTransition(supabase, vehicle);
  return transition.status;
}
