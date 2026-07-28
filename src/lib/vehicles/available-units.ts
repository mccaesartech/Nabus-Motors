import type { SupabaseClient } from "@supabase/supabase-js";
import { listingUnitCount } from "@/lib/vehicles/low-stock";
import { notDeletedFilter } from "@/lib/platform/trash-types";

/**
 * Total available units across the fleet (sums per-listing stock_quantity,
 * migration 082). Falls back to a row count when the column is not migrated.
 * Returns null when the count could not be determined at all.
 */
export async function countAvailableVehicleUnits(
  supabase: SupabaseClient
): Promise<number | null> {
  const { data, error } = await notDeletedFilter(
    supabase.from("vehicles").select("stock_quantity")
  ).eq("status", "available");

  if (!error) {
    return (data ?? []).reduce(
      (sum, row) => sum + listingUnitCount(row as { stock_quantity?: number | null }),
      0
    );
  }

  const { count, error: countError } = await notDeletedFilter(
    supabase.from("vehicles").select("id", { count: "exact", head: true })
  ).eq("status", "available");

  if (countError) {
    console.error("[stock-units] countAvailableVehicleUnits:", countError.message);
    return null;
  }

  return count ?? 0;
}
