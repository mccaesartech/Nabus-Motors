import type { PlatformRole } from "@/lib/platform/permissions";

/**
 * Privilege-escalation checks for platform user PATCH/invite role changes.
 * Mirrors `src/app/api/admin/platform-users/route.ts` so tests can lock the
 * policy without spinning up the full route handler.
 */
export function roleAssignmentDenial(params: {
  actorIsOwner: boolean;
  requestedRole?: PlatformRole | string | null;
  /** Current role of the target user (when modifying identity fields). */
  targetRole?: PlatformRole | string | null;
  modifyingIdentityFields?: boolean;
}): string | null {
  const requested = params.requestedRole ?? null;
  if (requested === "owner" && !params.actorIsOwner) {
    return "Only the owner can assign the owner role.";
  }
  if (requested === "super_admin" && !params.actorIsOwner) {
    return "Only the owner can assign the Super Admin role.";
  }
  if (
    !params.actorIsOwner &&
    params.modifyingIdentityFields &&
    params.targetRole === "owner"
  ) {
    return "Only the owner can modify an owner account.";
  }
  return null;
}

/** Missing / malformed Authorization header must never look authenticated. */
export function isBearerAuthorizationHeader(header: string | null | undefined): boolean {
  return typeof header === "string" && header.startsWith("Bearer ") && header.length > 7;
}
