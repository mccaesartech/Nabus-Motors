import type { SupabaseClient } from "@supabase/supabase-js";
import { hasPermission, normalizeRole } from "@/lib/platform/permissions";
import { platformPath } from "@/lib/platform/paths";

type ApprovalRecipient = {
  user_id: string | null;
  is_owner: boolean;
};

async function approvalRecipients(supabase: SupabaseClient): Promise<ApprovalRecipient[]> {
  const recipients: ApprovalRecipient[] = [{ user_id: null, is_owner: true }];

  const { data } = await supabase
    .from("platform_users")
    .select("id, role, status")
    .eq("status", "active");

  for (const user of data ?? []) {
    const role = normalizeRole(user.role);
    if (hasPermission(role, "inventory_approve")) {
      recipients.push({ user_id: user.id, is_owner: false });
    }
  }

  return recipients;
}

export async function notifyVehiclePendingApproval(
  supabase: SupabaseClient,
  vehicle: {
    id: string;
    year: number;
    make: string;
    model: string;
    submittedByName?: string | null;
  }
): Promise<void> {
  const title = `${vehicle.year} ${vehicle.make} ${vehicle.model}`;
  const submitter = vehicle.submittedByName?.trim();
  const message = submitter
    ? `${submitter} submitted a vehicle for approval`
    : "A manager submitted a vehicle for approval";
  const link = `${platformPath("inventory")}?approval=pending`;

  await supabase
    .from("admin_notifications")
    .delete()
    .eq("source_table", "vehicles")
    .eq("source_id", vehicle.id)
    .eq("type", "vehicle_pending_approval");

  const recipients = await approvalRecipients(supabase);
  const rows = recipients.map((recipient) => ({
    type: "vehicle_pending_approval",
    title: "Vehicle pending approval",
    message: `${title} — ${message}`,
    link,
    source_table: "vehicles",
    source_id: vehicle.id,
    recipient_user_id: recipient.is_owner ? null : recipient.user_id,
    recipient_is_owner: recipient.is_owner,
    metadata: {
      vehicle_id: vehicle.id,
      vehicle_title: title,
      submitted_by: submitter ?? null,
    },
  }));

  const { error } = await supabase.from("admin_notifications").insert(rows);
  if (error) {
    console.error("vehicle approval notification insert failed:", error.message);
  }
}

export async function clearVehiclePendingNotifications(
  supabase: SupabaseClient,
  vehicleId: string
): Promise<void> {
  await supabase
    .from("admin_notifications")
    .delete()
    .eq("source_table", "vehicles")
    .eq("source_id", vehicleId)
    .eq("type", "vehicle_pending_approval");
}
