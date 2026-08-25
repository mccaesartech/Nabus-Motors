import type { PlatformRole } from "@/lib/platform/permissions";

/**
 * Only Owner / Super Admin (and legacy administrator) may apply business-data
 * mutations immediately. Manager, staff, and other roles must use pending
 * approval where it exists (inventory) or are blocked with 403 elsewhere.
 */
export function canDirectMutate(role: PlatformRole): boolean {
  return (
    role === "owner" ||
    role === "super_admin" ||
    role === "administrator"
  );
}

/** True when writes must be approved (or blocked) rather than applied live. */
export function mutationRequiresApproval(role: PlatformRole): boolean {
  return !canDirectMutate(role);
}

export const MUTATION_APPROVAL_REQUIRED_MESSAGE =
  "This change requires Owner or Super Admin approval before it can be applied. For inventory, submit edits for review; otherwise ask an Owner or Super Admin to make the change.";