import type { createAdminSupabase } from "@/lib/supabase/admin";
import type { PlatformAuthContext } from "@/lib/admin/auth";
import { logPlatformActivity } from "@/lib/platform/activity";

type AdminSupabase = NonNullable<ReturnType<typeof createAdminSupabase>>;

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

/** Group key for counting same-type inventory (make + model + year). */
export function stockGroupKey(make: string, model: string, year: number): string {
  return `${make.trim().toLowerCase()}|${model.trim().toLowerCase()}|${year}`;
}

/** Other approved listings of the same type still marked available. */
export async function countAvailableSiblings(
  supabase: AdminSupabase,
  vehicle: Pick<VehicleStockIdentity, "id" | "make" | "model" | "year">
): Promise<number> {
  const { count, error } = await supabase
    .from("vehicles")
    .select("id", { count: "exact", head: true })
    .eq("make", vehicle.make)
    .eq("model", vehicle.model)
    .eq("year", vehicle.year)
    .eq("status", "available")
    .neq("id", vehicle.id);

  if (error) {
    console.error("[stock-automation] countAvailableSiblings:", error.message);
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
  supabase: AdminSupabase,
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

  return { status, autoPreOrder, availableSiblings };
}

/** Resolve sold → pre_order when admin requests sold on the last available unit. */
export async function resolveRequestedSoldStatus(
  supabase: AdminSupabase,
  vehicle: VehicleStockIdentity
): Promise<"sold" | "pre_order"> {
  const availableSiblings = await countAvailableSiblings(supabase, vehicle);
  return resolveStatusAfterSoldTransition(availableSiblings);
}
