import type { SupabaseClient } from "@supabase/supabase-js";
import { hasPermission, normalizeRole } from "@/lib/platform/permissions";
import { platformPath } from "@/lib/platform/paths";
import { notifyAdminOutbound } from "@/lib/notifications/admin-notify";
import { getSiteSettings } from "@/lib/platform/site-settings-server";
import {
  buildVehicleStockActionCopy,
  resolveStockActionReason,
  vehicleStockTitle,
  type VehicleStockActionInput,
} from "@/lib/platform/vehicle-stock-action";
import {
  buildFleetLowStockMessage,
  fleetIsLowStock,
} from "@/lib/vehicles/low-stock";
import { countAvailableVehicleUnits } from "@/lib/vehicles/available-units";

export {
  buildVehicleStockActionCopy,
  resolveStockActionReason,
  shouldNotifyVehicleStockAction,
  vehicleStockTitle,
  type VehicleStockActionInput,
  type VehicleStockActionReason,
} from "@/lib/platform/vehicle-stock-action";

type InventoryRecipient = {
  user_id: string | null;
  is_owner: boolean;
};

async function inventoryRecipients(supabase: SupabaseClient): Promise<InventoryRecipient[]> {
  const recipients: InventoryRecipient[] = [{ user_id: null, is_owner: true }];

  const { data } = await supabase
    .from("platform_users")
    .select("id, role, status")
    .eq("status", "active");

  for (const user of data ?? []) {
    const role = normalizeRole(user.role);
    if (hasPermission(role, "inventory_edit")) {
      recipients.push({ user_id: user.id, is_owner: false });
    }
  }

  return recipients;
}

function stockActionLink(vehicle: VehicleStockActionInput): string {
  if (vehicle.id) {
    return platformPath(`inventory/${vehicle.id}/edit`);
  }
  return platformPath("inventory");
}

async function clearFleetLowStockNotifications(supabase: SupabaseClient): Promise<void> {
  const { error } = await supabase.from("admin_notifications").delete().eq("type", "low_stock");
  if (error && !/relation|does not exist/i.test(error.message)) {
    console.error("[vehicle-stock] clear fleet low stock failed:", error.message);
  }
}

/**
 * Persist + email fleet-wide low stock when total available units fall below threshold.
 * Clears alerts when stock recovers. Dedupes so repeated sales do not re-spam email.
 */
export async function refreshFleetLowStockAlert(supabase: SupabaseClient): Promise<void> {
  const settings = await getSiteSettings();
  // Units, not rows: each listing contributes its stock_quantity (migration 082).
  const availableUnits = await countAvailableVehicleUnits(supabase);

  if (availableUnits === null) {
    console.error("[vehicle-stock] fleet available count failed");
    return;
  }

  const availableVehicles = availableUnits;
  if (
    !fleetIsLowStock(
      availableVehicles,
      settings.lowStockThreshold,
      settings.notifyLowStockEnabled
    )
  ) {
    await clearFleetLowStockNotifications(supabase);
    return;
  }

  const title = "Low inventory alert";
  const message = buildFleetLowStockMessage(availableVehicles, settings.lowStockThreshold);
  const link = platformPath("inventory?stock=low");

  const { data: existing, error: existingError } = await supabase
    .from("admin_notifications")
    .select("id")
    .eq("type", "low_stock")
    .limit(1);

  if (existingError) {
    console.error("[vehicle-stock] fleet low stock lookup failed:", existingError.message);
    return;
  }

  if (existing && existing.length > 0) {
    const { error: updateError } = await supabase
      .from("admin_notifications")
      .update({ title, message, link })
      .eq("type", "low_stock");
    if (updateError) {
      console.error("[vehicle-stock] fleet low stock update failed:", updateError.message);
    }
    return;
  }

  const recipients = await inventoryRecipients(supabase);
  const rows = recipients.map((recipient) => ({
    type: "low_stock",
    title,
    message,
    link,
    source_table: null,
    source_id: null,
    recipient_user_id: recipient.is_owner ? null : recipient.user_id,
    recipient_is_owner: recipient.is_owner,
    metadata: {
      available_vehicles: availableVehicles,
      threshold: settings.lowStockThreshold,
      suggestion: "add_or_import",
    },
  }));

  const { error } = await supabase.from("admin_notifications").insert(rows);
  if (error && !/duplicate|unique/i.test(error.message)) {
    console.error("[vehicle-stock] fleet low stock insert failed:", error.message);
  }

  try {
    if (settings.notifyEmailEnabled && settings.notifyLowStockEnabled) {
      await notifyAdminOutbound({
        subject: title,
        message: `${message}\n\nReview inventory: ${link}`,
        settings,
      });
    }
  } catch (notifyError) {
    console.error("[vehicle-stock] fleet low stock outbound notify failed:", notifyError);
  }
}

/**
 * Alert owner + inventory editors when a model needs Ghana / pre-order fulfillment review.
 * Dedupes by vehicle + type so repeated status flips do not spam the bell.
 */
export async function notifyVehicleStockActionNeeded(
  supabase: SupabaseClient,
  input: VehicleStockActionInput
): Promise<void> {
  const { title, message } = buildVehicleStockActionCopy(input);
  const link = stockActionLink(input);
  const type = "vehicle_stock_action";

  await supabase
    .from("admin_notifications")
    .delete()
    .eq("source_table", "vehicles")
    .eq("source_id", input.id)
    .eq("type", type);

  const recipients = await inventoryRecipients(supabase);
  const rows = recipients.map((recipient) => ({
    type,
    title,
    message,
    link,
    source_table: "vehicles",
    source_id: input.id,
    recipient_user_id: recipient.is_owner ? null : recipient.user_id,
    recipient_is_owner: recipient.is_owner,
    metadata: {
      vehicle_id: input.id,
      vehicle_slug: input.slug ?? null,
      vehicle_title: vehicleStockTitle(input),
      reason: input.reason,
      available_siblings: input.availableSiblings,
      source: input.source ?? null,
      suggestion: "preorder_or_ghana_or_import",
    },
  }));

  const { error } = await supabase.from("admin_notifications").insert(rows);
  if (error && !/duplicate|unique/i.test(error.message)) {
    console.error("[vehicle-stock] admin notification insert failed:", error.message);
  }

  try {
    const settings = await getSiteSettings();
    if (settings.notifyEmailEnabled && settings.notifyLowStockEnabled) {
      await notifyAdminOutbound({
        subject: title,
        message: `${message}\n\nReview in platform: ${link}`,
        settings,
      });
    }
  } catch (notifyError) {
    console.error("[vehicle-stock] outbound admin notify failed:", notifyError);
  }
}

/** Convenience: resolve reason + notify, or no-op when stock is healthy. */
export async function maybeNotifyVehicleStockAction(
  supabase: SupabaseClient,
  params: {
    id: string;
    slug?: string | null;
    year: number;
    make: string;
    model: string;
    availableSiblings: number;
    autoPreOrder?: boolean;
    source: "sold" | "purchase";
    sourceDetail?: string;
  }
): Promise<boolean> {
  const reason = resolveStockActionReason({
    autoPreOrder: params.autoPreOrder,
    source: params.source,
    availableSiblings: params.availableSiblings,
  });
  if (!reason) return false;

  await notifyVehicleStockActionNeeded(supabase, {
    id: params.id,
    slug: params.slug,
    year: params.year,
    make: params.make,
    model: params.model,
    reason,
    availableSiblings: params.availableSiblings,
    source: params.sourceDetail ?? params.source,
  });
  return true;
}
