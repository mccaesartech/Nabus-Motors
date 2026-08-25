import { createAdminSupabase } from "@/lib/supabase/admin";
import type { PlatformAuthContext } from "@/lib/admin/auth";

export type ActivityAction =
  | "login"
  | "logout"
  | "invite_sent"
  | "invite_accepted"
  | "user_updated"
  | "user_password_set"
  | "user_removed"
  | "vehicle_created"
  | "vehicle_submitted"
  | "vehicle_approved"
  | "vehicle_rejected"
  | "vehicle_updated"
  | "vehicle_auto_pre_order"
  | "vehicle_deleted"
  | "lead_updated"
  | "message_replied"
  | "conversation_started"
  | "ticket_claimed"
  | "ticket_closed"
  | "ticket_reassigned"
  | "ticket_deleted"
  | "team_message_sent"
  | "team_group_created"
  | "team_group_updated"
  | "sale_updated"
  | "settings_updated"
  | "maintenance_enabled"
  | "maintenance_disabled"
  | "export"
  | "expense_added"
  | "freight_quote_updated"
  | "freight_order_created"
  | "freight_order_updated"
  | "customer_deleted"
  | "item_deleted"
  | "item_restored"
  | "item_permanently_deleted"
  | "dashboard_transaction_dismissed"
  | "whatsapp_outreach_sent";

export async function logPlatformActivity(
  auth: PlatformAuthContext | null,
  action: ActivityAction,
  resource?: string,
  metadata: Record<string, unknown> = {}
): Promise<void> {
  const supabase = createAdminSupabase();
  if (!supabase) return;

  const row = {
    user_id: auth?.type === "user" ? auth.userId : null,
    actor_name: auth?.name ?? "Owner",
    actor_email: auth?.email ?? null,
    action,
    resource: resource ?? null,
    metadata,
  };

  const { error } = await supabase.from("platform_activity_log").insert(row);
  if (error) {
    console.error("platform_activity_log insert failed:", error.message);
  }
}
