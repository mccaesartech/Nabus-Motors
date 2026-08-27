import { NextResponse } from "next/server";
import {
  canDeleteAuditLog,
  canDeleteCustomer,
  getPlatformAuth,
  platformUserMustChangePassword,
} from "@/lib/admin/auth";
import { canDirectMutate } from "@/lib/platform/mutation-approval";
import { buildSessionPermissions, ROLE_LABELS } from "@/lib/platform/permissions";

export async function GET() {
  const auth = await getPlatformAuth();
  if (!auth) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  const mustChangePassword =
    auth.type === "user" && auth.userId
      ? auth.mustChangePassword ?? (await platformUserMustChangePassword(auth.userId))
      : false;

  const permissions = buildSessionPermissions(auth.role);
  const directMutate =
    auth.type === "owner" || canDirectMutate(auth.role);

  return NextResponse.json({
    ok: true,
    user: {
      name: auth.name,
      email: auth.email,
      role: auth.role,
      roleLabel: ROLE_LABELS[auth.role],
      type: auth.type,
      userId: auth.type === "user" ? auth.userId : null,
    },
    permissions,
    canDeleteCustomers: canDeleteCustomer(auth),
    canDeleteAuditLogs: canDeleteAuditLog(auth),
    canDirectMutate: directMutate,
    canPermanentlyDeleteTrash:
      auth.type === "owner" ||
      auth.role === "owner" ||
      auth.role === "super_admin",
    mustChangePassword,
  });
}
