import type { PlatformRole } from "@/lib/platform/permissions";
import { hasPermission } from "@/lib/platform/permissions";

export const VEHICLE_APPROVAL_STATUSES = [
  "approved",
  "pending_approval",
  "rejected",
] as const;

export type VehicleApprovalStatus = (typeof VEHICLE_APPROVAL_STATUSES)[number];

export const APPROVAL_STATUS_LABELS: Record<VehicleApprovalStatus, string> = {
  approved: "Approved",
  pending_approval: "Pending Approval",
  rejected: "Rejected",
};

export function canApproveInventory(role: PlatformRole): boolean {
  return hasPermission(role, "inventory_approve");
}

export function managerNeedsApproval(role: PlatformRole): boolean {
  return role === "manager";
}

export function defaultApprovalStatusForCreate(role: PlatformRole): VehicleApprovalStatus {
  return managerNeedsApproval(role) ? "pending_approval" : "approved";
}

export { hasPendingEdits, isPendingNewListing, isPubliclyListed, isRejectedEditPending, canReviewVehicleApproval } from "./vehicle-pending-changes";

export function managerCanDeleteVehicle(
  role: PlatformRole,
  approvalStatus: string | null | undefined
): boolean {
  if (!managerNeedsApproval(role)) return true;
  return approvalStatus === "pending_approval" || approvalStatus === "rejected";
}
