import { NextResponse } from "next/server";
import { canDeleteCustomer, getPlatformAuth } from "@/lib/admin/auth";
import { hasPermission, ROLE_LABELS } from "@/lib/platform/permissions";

export async function GET() {
  const auth = await getPlatformAuth();
  if (!auth) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  const permissions = {
    dashboard: hasPermission(auth.role, "dashboard"),
    inventory: hasPermission(auth.role, "inventory"),
    inventory_edit: hasPermission(auth.role, "inventory_edit"),
    inventory_approve: hasPermission(auth.role, "inventory_approve"),
    customers: hasPermission(auth.role, "customers"),
    sales: hasPermission(auth.role, "sales"),
    finance: hasPermission(auth.role, "finance"),
    leads: hasPermission(auth.role, "leads"),
    freight: hasPermission(auth.role, "freight"),
    parts: hasPermission(auth.role, "parts"),
    messages: hasPermission(auth.role, "messages"),
    emails: hasPermission(auth.role, "emails"),
    team_messages: hasPermission(auth.role, "team_messages"),
    documents: hasPermission(auth.role, "documents"),
    reports: hasPermission(auth.role, "reports"),
    users: hasPermission(auth.role, "users"),
    settings: hasPermission(auth.role, "settings"),
    site_content: hasPermission(auth.role, "site_content"),
    activity: hasPermission(auth.role, "activity"),
    trash: hasPermission(auth.role, "trash"),
  };

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
