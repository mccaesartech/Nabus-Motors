import type { SupabaseClient } from "@supabase/supabase-js";
import { formatPlatformPrice } from "@/lib/currency";
import { hasPermission, normalizeRole } from "@/lib/platform/permissions";
import { platformPath } from "@/lib/platform/paths";
import { notifyAdminOutbound } from "@/lib/notifications/admin-notify";
import { getSiteSettings } from "@/lib/platform/site-settings";

type LeadsRecipient = {
  user_id: string | null;
  is_owner: boolean;
};

async function leadsRecipients(supabase: SupabaseClient): Promise<LeadsRecipient[]> {
  const recipients: LeadsRecipient[] = [{ user_id: null, is_owner: true }];

  const { data } = await supabase
    .from("platform_users")
    .select("id, role, status")
    .eq("status", "active");

  for (const user of data ?? []) {
    const role = normalizeRole(user.role);
    if (hasPermission(role, "leads")) {
      recipients.push({ user_id: user.id, is_owner: false });
    }
  }

  return recipients;
}

export type VehicleSaleNotificationInput = {
  kind: "buy" | "pre_order";
  customerName: string;
  customerEmail: string;
  customerPhone?: string | null;
  vehicleTitles: string[];
  referenceId: string;
  sourceTable: "parts_orders" | "preorder_inquiries";
  link: string;
  totalUsd?: number | null;
  registrationId?: string | null;
};

function buildSaleMessage(input: VehicleSaleNotificationInput): string {
  const vehicles = input.vehicleTitles.join(", ") || "vehicle";
  const contact = [input.customerName, input.customerEmail, input.customerPhone?.trim()]
    .filter(Boolean)
    .join(" · ");
  const kindLabel = input.kind === "buy" ? "Purchase" : "Pre-order";
  const ref =
    input.registrationId?.trim() ||
    input.referenceId.slice(0, 8).toUpperCase();
  const total =
    input.totalUsd != null && input.totalUsd > 0
      ? ` · ${formatPlatformPrice(input.totalUsd)}`
      : "";
  return `${kindLabel}: ${vehicles} — ${contact} (ref ${ref})${total}`;
}

function buildSaleTitle(input: VehicleSaleNotificationInput): string {
  const kindLabel = input.kind === "buy" ? "Vehicle purchase" : "Vehicle pre-order";
  const vehicle = input.vehicleTitles[0] ?? "vehicle";
  return input.vehicleTitles.length > 1
    ? `${kindLabel} — ${input.vehicleTitles.length} vehicles`
    : `${kindLabel}: ${vehicle}`;
}

/** Target owner + leads-enabled team (managers, staff with leads access) in the bell. */
export async function notifyVehicleSaleToLeadsTeam(
  supabase: SupabaseClient,
  input: VehicleSaleNotificationInput
): Promise<void> {
  const title = buildSaleTitle(input);
  const message = buildSaleMessage(input);
  const type = input.kind === "buy" ? "vehicle_order" : "preorder";
  const metadata = {
    kind: input.kind,
    customer: {
      name: input.customerName,
      email: input.customerEmail,
      phone: input.customerPhone ?? null,
    },
    vehicles: input.vehicleTitles,
    reference_id: input.referenceId,
    registration_id: input.registrationId ?? null,
    total_usd: input.totalUsd ?? null,
  };

  await supabase
    .from("admin_notifications")
    .delete()
    .eq("source_table", input.sourceTable)
    .eq("source_id", input.referenceId);

  const recipients = await leadsRecipients(supabase);
  const rows = recipients.map((recipient) => ({
    type,
    title,
    message,
    link: input.link,
    source_table: input.sourceTable,
    source_id: input.referenceId,
    recipient_user_id: recipient.is_owner ? null : recipient.user_id,
    recipient_is_owner: recipient.is_owner,
    metadata,
  }));

  const { error } = await supabase.from("admin_notifications").insert(rows);
  if (error && !/duplicate|unique/i.test(error.message)) {
    console.error("[vehicle-sale] admin notification insert failed:", error.message);
  }

  try {
    const settings = await getSiteSettings();
    const emailEnabled =
      settings.notifyEmailEnabled &&
      (input.kind === "pre_order" ? settings.notifyPreordersEnabled : true);

    if (emailEnabled) {
      await notifyAdminOutbound({
        subject: title,
        message: `${message}\n\nReview in platform: ${input.link}`,
        settings,
      });
    }
  } catch (notifyError) {
    console.error("[vehicle-sale] outbound admin notify failed:", notifyError);
  }
}

export function vehicleOrderLeadsLink(orderId: string): string {
  return `${platformPath("leads")}/order/${orderId}`;
}

export function preorderLeadsLink(inquiryId: string): string {
  return `${platformPath("leads")}/preorder/${inquiryId}`;
}
