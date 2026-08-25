import type { SupabaseClient } from "@supabase/supabase-js";
import { listingUnitCount } from "@/lib/vehicles/low-stock";
import { notDeletedFilter } from "@/lib/platform/trash-types";
import {
  SCHEMA_CAPS,
  isSchemaMissing,
  markSchemaMissing,
  markSchemaPresent,
} from "@/lib/observability/schema-capability";
import { isMissingColumnError, reportSchemaIssue } from "@/lib/observability/schema-issue";

/**
 * Total available units across the fleet (sums per-listing stock_quantity,
 * migration 082). Falls back to a row count when the column is not migrated.
 * Returns null when the count could not be determined at all.
 */
export async function countAvailableVehicleUnits(
  supabase: SupabaseClient
): Promise<number | null> {
  const skipStock = isSchemaMissing(SCHEMA_CAPS.vehiclesStockQuantity);
  const skipDeletedAt = isSchemaMissing(SCHEMA_CAPS.vehiclesDeletedAt);

  if (!skipStock) {
    let stockQuery = supabase.from("vehicles").select("stock_quantity").eq("status", "available");
    if (!skipDeletedAt) {
      stockQuery = notDeletedFilter(stockQuery);
    }
    const { data, error } = await stockQuery;

    if (!error) {
      if (!skipDeletedAt) markSchemaPresent(SCHEMA_CAPS.vehiclesDeletedAt);
      markSchemaPresent(SCHEMA_CAPS.vehiclesStockQuantity);
      return (data ?? []).reduce(
        (sum, row) => sum + listingUnitCount(row as { stock_quantity?: number | null }),
        0
      );
    }

    if (isMissingColumnError(error.message, "stock_quantity")) {
      reportSchemaIssue({
        table: "vehicles",
        column: "stock_quantity",
        migration: "082_vehicle_stock_quantity.sql / 086_postgres_error_clearance.sql",
        source: "countAvailableVehicleUnits",
        message: error.message,
      });
      markSchemaMissing(SCHEMA_CAPS.vehiclesStockQuantity);
    } else if (isMissingColumnError(error.message, "deleted_at")) {
      reportSchemaIssue({
        table: "vehicles",
        column: "deleted_at",
        migration: "054_platform_trash.sql / 086_postgres_error_clearance.sql",
        source: "countAvailableVehicleUnits",
        message: error.message,
      });
      markSchemaMissing(SCHEMA_CAPS.vehiclesDeletedAt);
      // Retry stock sum without deleted_at filter.
      const retry = await supabase
        .from("vehicles")
        .select("stock_quantity")
        .eq("status", "available");
      if (!retry.error) {
        markSchemaPresent(SCHEMA_CAPS.vehiclesStockQuantity);
        return (retry.data ?? []).reduce(
          (sum, row) => sum + listingUnitCount(row as { stock_quantity?: number | null }),
          0
        );
      }
    } else {
      console.error("[stock-units] countAvailableVehicleUnits:", error.message);
    }
  }

  let countQuery = supabase
    .from("vehicles")
    .select("id", { count: "exact", head: true })
    .eq("status", "available");
  if (!isSchemaMissing(SCHEMA_CAPS.vehiclesDeletedAt)) {
    countQuery = notDeletedFilter(countQuery);
  }
  const { count, error: countError } = await countQuery;

  if (countError) {
    if (isMissingColumnError(countError.message, "deleted_at")) {
      reportSchemaIssue({
        table: "vehicles",
        column: "deleted_at",
        migration: "054_platform_trash.sql / 086_postgres_error_clearance.sql",
        source: "countAvailableVehicleUnits.count",
        message: countError.message,
      });
      markSchemaMissing(SCHEMA_CAPS.vehiclesDeletedAt);
      const legacy = await supabase
        .from("vehicles")
        .select("id", { count: "exact", head: true })
        .eq("status", "available");
      return legacy.count ?? 0;
    }
    console.error("[stock-units] countAvailableVehicleUnits:", countError.message);
    return null;
  }

  return count ?? 0;
}
