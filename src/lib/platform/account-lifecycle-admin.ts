import "server-only";
import { createAdminSupabase } from "@/lib/supabase/admin";
import type { AccountStatus } from "@/lib/customer/account-lifecycle";
import { effectiveAccountStatus } from "@/lib/platform/account-lifecycle-status";

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

const PROFILE_LIFECYCLE_SELECT =
  "id, account_status, registration_id, email, first_name, last_name, phone, is_anonymized, deletion_requested_at, scheduled_deletion_at, retention_expires_at, deleted_at, anonymized_at, deletion_reason, created_at";

function normalizeLifecycleRow(row: AccountLifecycleListItem): AccountLifecycleListItem {
  return {
    ...row,
    account_status: effectiveAccountStatus(row.account_status, row.deleted_at),
  };
}

export async function listAccountLifecycle(
  tab: AccountLifecycleTab,
  search?: string
): Promise<AccountLifecycleListItem[]> {
  const supabase = createAdminSupabase();
  if (!supabase) return [];

  const statuses = TAB_STATUSES[tab];
  let query = supabase
    .from("profiles")
    .select(PROFILE_LIFECYCLE_SELECT)
    .order("updated_at", { ascending: false })
    .limit(200);

  // Soft-deleted customers (deleted_at set) must never appear under Active /
  // Suspended / Pending — even if account_status was left as 'active'.
  if (tab === "archived") {
    query = query.or(
      `account_status.in.(${statuses.join(",")}),deleted_at.not.is.null`
    );
  } else {
    query = query.in("account_status", statuses).is("deleted_at", null);
  }

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

  return ((data as AccountLifecycleListItem[]) ?? []).map(normalizeLifecycleRow);
}

export async function getAccountLifecycleDetail(
  userId: string
): Promise<AccountLifecycleListItem | null> {
  const supabase = createAdminSupabase();
  if (!supabase) return null;

  const { data, error } = await supabase
    .from("profiles")
    .select(PROFILE_LIFECYCLE_SELECT)
    .eq("id", userId)
    .maybeSingle();

  if (error) {
    console.error("[account-lifecycle-admin] detail failed:", error.message);
    return null;
  }

  if (!data) return null;
  return normalizeLifecycleRow(data as AccountLifecycleListItem);
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
