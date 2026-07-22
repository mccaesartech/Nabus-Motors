import "server-only";
import { createAdminSupabase } from "@/lib/supabase/admin";
import type { AccountStatus } from "@/lib/customer/account-lifecycle";

export type AccountLifecycleListItem = {
  id: string;
  account_status: AccountStatus;
  registration_id: string | null;
  email: string | null;
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
  is_anonymized: boolean;
  deletion_requested_at: string | null;
  scheduled_deletion_at: string | null;
  retention_expires_at: string | null;
  deleted_at: string | null;
  anonymized_at: string | null;
  deletion_reason: string | null;
  created_at: string;
};

export type AccountLifecycleTab =
  | "active"
  | "suspended"
  | "pending_deletion"
  | "archived";

const TAB_STATUSES: Record<AccountLifecycleTab, AccountStatus[]> = {
  active: ["active"],
  suspended: ["suspended"],
  pending_deletion: ["pending_deletion"],
  archived: ["archived", "deleted"],
};

export async function listAccountLifecycle(
  tab: AccountLifecycleTab,
  search?: string
): Promise<AccountLifecycleListItem[]> {
  const supabase = createAdminSupabase();
  if (!supabase) return [];

  const statuses = TAB_STATUSES[tab];
  let query = supabase
    .from("profiles")
    .select(
      "id, account_status, registration_id, email, first_name, last_name, phone, is_anonymized, deletion_requested_at, scheduled_deletion_at, retention_expires_at, deleted_at, anonymized_at, deletion_reason, created_at"
    )
    .in("account_status", statuses)
    .order("updated_at", { ascending: false })
    .limit(200);

  const term = search?.trim();
  if (term) {
    const pattern = `%${term}%`;
    query = query.or(
      `email.ilike.${pattern},registration_id.ilike.${pattern},first_name.ilike.${pattern},last_name.ilike.${pattern}`
    );
  }

  const { data, error } = await query;
  if (error) {
    console.error("[account-lifecycle-admin] list failed:", error.message);
    return [];
  }

  return (data as AccountLifecycleListItem[]) ?? [];
}

export async function getAccountLifecycleDetail(
  userId: string
): Promise<AccountLifecycleListItem | null> {
  const supabase = createAdminSupabase();
  if (!supabase) return null;

  const { data, error } = await supabase
    .from("profiles")
    .select(
      "id, account_status, registration_id, email, first_name, last_name, phone, is_anonymized, deletion_requested_at, scheduled_deletion_at, retention_expires_at, deleted_at, anonymized_at, deletion_reason, created_at"
    )
    .eq("id", userId)
    .maybeSingle();

  if (error) {
    console.error("[account-lifecycle-admin] detail failed:", error.message);
    return null;
  }

  return (data as AccountLifecycleListItem | null) ?? null;
}

export async function getAccountLifecycleAudit(
  userId: string,
  limit = 50
): Promise<
  Array<{
    id: string;
    created_at: string;
    action: string;
    administrator_id: string | null;
    ip_address: string | null;
    metadata: Record<string, unknown>;
  }>
> {
  const supabase = createAdminSupabase();
  if (!supabase) return [];

  const { data, error } = await supabase
    .from("account_lifecycle_audit_log")
    .select("id, created_at, action, administrator_id, ip_address, metadata")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    console.error("[account-lifecycle-admin] audit failed:", error.message);
    return [];
  }

  return (data ?? []) as Array<{
    id: string;
    created_at: string;
    action: string;
    administrator_id: string | null;
    ip_address: string | null;
    metadata: Record<string, unknown>;
  }>;
}
