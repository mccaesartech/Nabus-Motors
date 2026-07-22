import { NextResponse } from "next/server";
import { canDeleteCustomer, getPlatformAuth } from "@/lib/admin/auth";
import { buildSessionPermissions, ROLE_LABELS } from "@/lib/platform/permissions";

export async function GET() {
  const auth = await getPlatformAuth();
  if (!auth) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  const permissions = buildSessionPermissions(auth.role);

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
  });
}
