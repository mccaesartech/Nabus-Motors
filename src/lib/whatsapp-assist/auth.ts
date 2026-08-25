import "server-only";

import { requireAdmin } from "@/lib/admin/auth";
import { hasPermission, type PlatformPermission } from "@/lib/platform/permissions";

const WHATSAPP_ASSIST_PERMISSIONS: PlatformPermission[] = [
  "customers",
  "leads",
  "messages",
];

export async function requireWhatsAppAssistAccess() {
  const result = await requireAdmin();
  if (!result.ok) return result;

  const allowed = WHATSAPP_ASSIST_PERMISSIONS.some((permission) =>
    hasPermission(result.auth.role, permission)
  );

  if (!allowed) {
    return {
      ok: false as const,
      status: 403,
      message: "You do not have permission to contact customers via WhatsApp.",
      auth: result.auth,
    };
  }

  return result;
}
