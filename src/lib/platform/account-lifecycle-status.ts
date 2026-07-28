import type { AccountStatus } from "@/lib/customer/account-lifecycle.shared";

/**
 * Soft-deleted profiles (admin customer delete) may keep account_status='active'
 * while deleted_at is set. Treat those as deleted for lifecycle UI/lists.
 */
export function effectiveAccountStatus(
  accountStatus: AccountStatus,
  deletedAt: string | null | undefined
): AccountStatus {
  if (deletedAt) return "deleted";
  return accountStatus;
}

export function shouldAppearInLifecycleTab(
  tab: "active" | "suspended" | "pending_deletion" | "archived",
  accountStatus: AccountStatus,
  deletedAt: string | null | undefined
): boolean {
  const effective = effectiveAccountStatus(accountStatus, deletedAt);
  if (tab === "archived") {
    return effective === "archived" || effective === "deleted";
  }
  if (deletedAt) return false;
  return effective === (tab === "pending_deletion" ? "pending_deletion" : tab);
}
