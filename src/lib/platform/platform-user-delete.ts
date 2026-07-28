import { normalizeRole } from "@/lib/platform/permissions";

export type PlatformUserDeleteTarget = {
  id: string;
  role: string;
  deleted_at?: string | null;
};

/**
 * Soft-delete guards for platform team users.
 * Owner accounts are never deletable; self-delete is blocked.
 */
export function assertPlatformUserDeletable(
  user: PlatformUserDeleteTarget,
  actorUserId?: string | null
): { ok: true } | { ok: false; message: string; status: number } {
  if (normalizeRole(user.role) === "owner") {
    return {
      ok: false,
      message: "The owner account cannot be deleted.",
      status: 403,
    };
  }

  if (user.deleted_at) {
    return {
      ok: false,
      message: "User is already in trash.",
      status: 400,
    };
  }

  if (actorUserId && user.id === actorUserId) {
    return {
      ok: false,
      message: "You cannot delete your own account.",
      status: 403,
    };
  }

  return { ok: true };
}
