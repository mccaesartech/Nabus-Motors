export const PLATFORM_ROLES = ["owner", "super_admin", "manager", "staff"] as const;

export type PlatformRole = (typeof PLATFORM_ROLES)[number];

export type PlatformPermission =
  | "dashboard"
  | "inventory"
  | "inventory_edit"
  | "inventory_approve"
  | "customers"
  | "sales"
  | "finance"
  | "leads"
  | "freight"
  | "parts"
  | "messages"
  | "emails"
  | "team_messages"
  | "documents"
  | "reports"
  | "users"
  | "settings"
  | "site_content"
  | "activity"
  | "trash";

export const ROLE_LABELS: Record<PlatformRole, string> = {
  owner: "Owner",
  super_admin: "Super Admin",
  manager: "Manager",
  staff: "Staff",
};

/** Roles the owner can assign when inviting team members */
export const INVITABLE_ROLES: PlatformRole[] = ["super_admin", "manager", "staff"];

const ROLE_PERMISSIONS: Record<PlatformRole, ReadonlySet<PlatformPermission>> = {
  owner: new Set([
    "dashboard",
    "inventory",
    "inventory_edit",
    "inventory_approve",
    "customers",
    "sales",
    "finance",
    "leads",
    "freight",
    "parts",
    "messages",
    "emails",
    "team_messages",
    "documents",
    "reports",
    "users",
    "settings",
    "site_content",
    "activity",
    "trash",
  ]),
  super_admin: new Set([
    "dashboard",
    "inventory",
    "inventory_edit",
    "inventory_approve",
    "customers",
    "sales",
    "finance",
    "leads",
    "freight",
    "parts",
    "messages",
    "emails",
    "team_messages",
    "documents",
    "reports",
    "users",
    "settings",
    "site_content",
    "activity",
    "trash",
  ]),
  manager: new Set([
    "dashboard",
    "inventory",
    "inventory_edit",
    "customers",
    "sales",
    "leads",
    "freight",
    "parts",
    "messages",
    "emails",
    "team_messages",
    "documents",
    "site_content",
    "trash",
  ]),
  staff: new Set([
    "dashboard",
    "inventory",
    "customers",
    "leads",
    "freight",
    "messages",
    "emails",
    "team_messages",
  ]),
};

const LEGACY_ROLE_MAP: Record<string, PlatformRole> = {
  owner: "owner",
  Owner: "owner",
  super_admin: "super_admin",
  "Super Admin": "super_admin",
  manager: "manager",
  Manager: "manager",
  staff: "staff",
  "Sales Officer": "staff",
  "Finance Officer": "staff",
  Viewer: "staff",
};

export function normalizeRole(role: string | null | undefined): PlatformRole {
  if (!role) return "staff";
  return LEGACY_ROLE_MAP[role] ?? (PLATFORM_ROLES.includes(role as PlatformRole) ? (role as PlatformRole) : "staff");
}

export function hasPermission(role: PlatformRole, permission: PlatformPermission): boolean {
  return ROLE_PERMISSIONS[role]?.has(permission) ?? false;
}

export function canManageUsers(role: PlatformRole): boolean {
  return hasPermission(role, "users");
}

export function canViewFinance(role: PlatformRole): boolean {
  return hasPermission(role, "finance");
}

export function canEditInventory(role: PlatformRole): boolean {
  return hasPermission(role, "inventory_edit");
}

export function canApproveInventory(role: PlatformRole): boolean {
  return hasPermission(role, "inventory_approve");
}

/** AI-assisted customer-visible shipment / freight notes — owners and managers only. */
export function canUseCustomerNoteAi(role: PlatformRole): boolean {
  return role === "owner" || role === "super_admin" || role === "manager";
}

/** View all customer support tickets and reassign across staff. */
export function canOversightCustomerTickets(
  role: PlatformRole | "owner"
): boolean {
  return (
    role === "owner" ||
    role === "super_admin" ||
    role === "manager"
  );
}

export function permissionForPath(pathname: string): PlatformPermission | null {
  if (pathname.startsWith("/platform/finance")) return "finance";
  if (pathname.startsWith("/platform/freight")) return "freight";
  if (pathname.startsWith("/platform/parts")) return "parts";
  if (pathname.startsWith("/platform/appointments")) return "leads";
  if (pathname.startsWith("/platform/tracking")) return "leads";
  if (pathname.startsWith("/platform/users")) return "users";
  if (pathname.startsWith("/platform/site-content")) return "site_content";
  if (pathname.startsWith("/platform/settings")) return "settings";
  if (pathname.startsWith("/platform/reports")) return "reports";
  if (pathname.startsWith("/platform/trash")) return "trash";
  if (pathname === "/platform/inventory/new") return "inventory_edit";
  if (/^\/platform\/inventory\/[^/]+\/edit\/?$/.test(pathname)) return "inventory_edit";
  if (pathname.startsWith("/platform/inventory")) return "inventory";
  if (pathname.startsWith("/platform/customers")) return "customers";
  if (pathname.startsWith("/platform/sales")) return "sales";
  if (pathname.startsWith("/platform/leads")) return "leads";
  if (pathname.startsWith("/platform/team-chat")) return "team_messages";
  if (pathname.startsWith("/platform/messages")) return "messages";
  if (pathname.startsWith("/platform/emails")) return "emails";
  if (pathname.startsWith("/platform/documents")) return "documents";
  if (pathname.startsWith("/platform/dashboard") || pathname === "/platform") {
    return "dashboard";
  }
  return null;
}

export function navPermissionForHref(href: string): PlatformPermission {
  const map: Record<string, PlatformPermission> = {
    dashboard: "dashboard",
    inventory: "inventory",
    customers: "customers",
    sales: "sales",
    finance: "finance",
    leads: "leads",
    appointments: "leads",
    tracking: "leads",
    freight: "freight",
    parts: "parts",
    messages: "messages",
    emails: "emails",
    "team-chat": "team_messages",
    documents: "documents",
    reports: "reports",
    users: "users",
    settings: "settings",
    "site-content": "site_content",
    trash: "trash",
  };
  const segment = href.replace("/platform/", "").split("/")[0];
  return map[segment] ?? "dashboard";
}

export function getRolePermissionsTable(): Array<{
  permission: PlatformPermission;
  owner: boolean;
  super_admin: boolean;
  manager: boolean;
  staff: boolean;
}> {
  const permissions: PlatformPermission[] = [
    "dashboard",
    "inventory",
    "inventory_edit",
    "inventory_approve",
    "leads",
    "freight",
    "parts",
    "messages",
    "emails",
    "team_messages",
    "customers",
    "sales",
    "documents",
    "finance",
    "reports",
    "users",
    "settings",
    "site_content",
    "activity",
    "trash",
  ];

  return permissions.map((permission) => ({
    permission,
    owner: hasPermission("owner", permission),
    super_admin: hasPermission("super_admin", permission),
    manager: hasPermission("manager", permission),
    staff: hasPermission("staff", permission),
  }));
}
