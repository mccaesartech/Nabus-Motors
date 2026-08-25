import type { PlatformAuthContext } from "@/lib/admin/auth";
import { canViewAuditLog as authCanViewAuditLog } from "@/lib/admin/auth";
import type { PlatformRole } from "@/lib/platform/permissions";
import { hasPermission } from "@/lib/platform/permissions";

/** Re-export owner + super_admin gate from admin auth. */
export function canViewAuditLog(auth: PlatformAuthContext): boolean {
  return authCanViewAuditLog(auth);
}

/** Permission-based check used by nav + path gating. */
export function roleCanViewAuditLog(role: PlatformRole): boolean {
  return hasPermission(role, "audit_log");
}
