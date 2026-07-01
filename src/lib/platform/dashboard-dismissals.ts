import type { SupabaseClient } from "@supabase/supabase-js";
import type { PlatformAuthContext } from "@/lib/admin/auth";
import { logPlatformActivity } from "@/lib/platform/activity";

function actorFields(auth: PlatformAuthContext) {
  return {
    dismissed_by_user_id: auth.type === "user" ? auth.userId ?? null : null,
    dismissed_by_name: auth.name,
    dismissed_by_email: auth.email,
  };
}

export async function listDismissedTransactionVehicleIds(
  supabase: SupabaseClient
): Promise<string[]> {
  const { data, error } = await supabase
    .from("dashboard_transaction_dismissals")
    .select("vehicle_id");

  if (error) {
    console.error("[listDismissedTransactionVehicleIds]", error.message);
    return [];
  }

  return (data ?? []).map((row) => String(row.vehicle_id));
}

export async function dismissDashboardTransaction(
  supabase: SupabaseClient,
  auth: PlatformAuthContext,
  vehicleId: string
): Promise<{ ok: true } | { ok: false; message: string; status?: number }> {
  const { data: vehicle, error: vehicleError } = await supabase
    .from("vehicles")
    .select("id, year, make, model, status, deleted_at")
    .eq("id", vehicleId)
    .maybeSingle();

  if (vehicleError) {
    return { ok: false, message: vehicleError.message, status: 500 };
  }

  if (!vehicle || vehicle.deleted_at) {
    return { ok: false, message: "Vehicle not found in active inventory.", status: 404 };
  }

  const { error } = await supabase.from("dashboard_transaction_dismissals").upsert(
    {
      vehicle_id: vehicleId,
      dismissed_at: new Date().toISOString(),
      ...actorFields(auth),
    },
    { onConflict: "vehicle_id" }
  );

  if (error) {
    return { ok: false, message: error.message, status: 500 };
  }

  const label = `${vehicle.year} ${vehicle.make} ${vehicle.model}`.trim();
  await logPlatformActivity(auth, "dashboard_transaction_dismissed", label, {
    vehicleId,
    status: vehicle.status,
  });

  return { ok: true };
}
