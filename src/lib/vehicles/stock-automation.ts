import type { SupabaseClient } from "@supabase/supabase-js";
import type { PlatformAuthContext } from "@/lib/admin/auth";
import { logPlatformActivity } from "@/lib/platform/activity";
import {
  maybeNotifyVehicleStockAction,
  refreshFleetLowStockAlert,
} from "@/lib/platform/vehicle-stock-notifications";
import { listingUnitCount, stockGroupKey } from "@/lib/vehicles/low-stock";

export type VehicleStockIdentity = {
  id: string;
  slug?: string | null;
  make: string;
  model: string;
  year: number;
};

export type SoldStatusTransition = {
  status: "sold" | "pre_order";
  autoPreOrder: boolean;
  availableSiblings: number;
};

export { stockGroupKey };

/** Available units on other listings of the same make/model/year (sums stock_quantity). */
export async function countAvailableSiblings(
  supabase: SupabaseClient,
  vehicle: Pick<VehicleStockIdentity, "id" | "make" | "model" | "year">
): Promise<number> {
  const { data, error } = await supabase
    .from("vehicles")
    .select("id, stock_quantity")
    .eq("make", vehicle.make)
    .eq("model", vehicle.model)
    .eq("year", vehicle.year)
    .eq("status", "available")
    .neq("id", vehicle.id);

  if (!error) {
    return (data ?? []).reduce(
      (sum, row) => sum + listingUnitCount(row as { stock_quantity?: number | null }),
      0
    );
  }

  // stock_quantity column missing (migration 082 not run) → legacy row count.
  const { count, error: countError } = await supabase
    .from("vehicles")
    .select("id", { count: "exact", head: true })
    .eq("make", vehicle.make)
    .eq("model", vehicle.model)
    .eq("year", vehicle.year)
    .eq("status", "available")
    .neq("id", vehicle.id);

  if (countError) {
    console.error("[stock-automation] countAvailableSiblings:", countError.message);
    return 0;
  }

  return count ?? 0;
}

/**
 * When the last available unit of a type sells, keep the listing on-site as pre-order
 * instead of hiding it as sold.
 */
export function resolveStatusAfterSoldTransition(
  availableSiblings: number
): "sold" | "pre_order" {
  return availableSiblings === 0 ? "pre_order" : "sold";
}

export async function applySoldStatusTransition(
  supabase: SupabaseClient,
  vehicle: VehicleStockIdentity,
  options?: {
    auth?: PlatformAuthContext | null;
    source?: string;
  }
): Promise<SoldStatusTransition> {
  const availableSiblings = await countAvailableSiblings(supabase, vehicle);
  const status = resolveStatusAfterSoldTransition(availableSiblings);
  const autoPreOrder = status === "pre_order";

  const { error } = await supabase
    .from("vehicles")
    .update({ status })
    .eq("id", vehicle.id);

  if (error) {
    console.error("[stock-automation] applySoldStatusTransition:", error.message);
    throw new Error(error.message);
  }

  if (autoPreOrder && options?.auth) {
    await logPlatformActivity(options.auth, "vehicle_auto_pre_order", vehicle.slug ?? vehicle.id, {
      id: vehicle.id,
      make: vehicle.make,
      model: vehicle.model,
      year: vehicle.year,
      available_siblings: availableSiblings,
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
      availableSiblings,
      autoPreOrder,
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

  return { status, autoPreOrder, availableSiblings };
}

/** Resolve sold → pre_order when admin requests sold on the last available unit. */
export async function resolveRequestedSoldStatus(
  supabase: SupabaseClient,
  vehicle: VehicleStockIdentity
): Promise<"sold" | "pre_order"> {
  const availableSiblings = await countAvailableSiblings(supabase, vehicle);
  return resolveStatusAfterSoldTransition(availableSiblings);
}
