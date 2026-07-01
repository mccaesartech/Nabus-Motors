/** Proposed vehicle field updates stored while awaiting owner approval. */
export type VehiclePendingChanges = Record<string, unknown>;

export function hasPendingEdits(pendingChanges: unknown): pendingChanges is VehiclePendingChanges {
  return (
    pendingChanges !== null &&
    pendingChanges !== undefined &&
    typeof pendingChanges === "object" &&
    Object.keys(pendingChanges as object).length > 0
  );
}

/** Live on the public site: approved, or pending/rejected edit with unchanged live row. */
export function isPubliclyListed(
  approvalStatus: string | null | undefined,
  pendingChanges?: unknown
): boolean {
  if (!approvalStatus || approvalStatus === "approved") return true;
  if (hasPendingEdits(pendingChanges)) {
    return approvalStatus === "pending_approval" || approvalStatus === "rejected";
  }
  return false;
}

/** Rejected proposed edits that can be re-approved or discarded. */
export function isRejectedEditPending(
  approvalStatus: string | null | undefined,
  pendingChanges?: unknown
): boolean {
  return approvalStatus === "rejected" && hasPendingEdits(pendingChanges);
}

export function canReviewVehicleApproval(
  approvalStatus: string | null | undefined
): boolean {
  return approvalStatus === "pending_approval" || approvalStatus === "rejected";
}

/** Brand-new manager submission not yet published. */
export function isPendingNewListing(
  approvalStatus: string | null | undefined,
  pendingChanges?: unknown
): boolean {
  return approvalStatus === "pending_approval" && !hasPendingEdits(pendingChanges);
}

export function mergeVehicleWithPending<T extends Record<string, unknown>>(
  vehicle: T,
  pendingChanges: VehiclePendingChanges | null | undefined
): T {
  if (!hasPendingEdits(pendingChanges)) return vehicle;
  return { ...vehicle, ...pendingChanges };
}
