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
  | "trash"
  | "account_lifecycle";

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
    "account_lifecycle",
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
    "account_lifecycle",
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
    "account_lifecycle",
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

/**
 * Installing the authenticated platform PWA is an account convenience, not an
 * administrative permission. Every recognized platform role may use it.
 */
export function canInstallPlatformApp(role: PlatformRole): boolean {
  return PLATFORM_ROLES.includes(role);
}

export const ALL_PLATFORM_PERMISSIONS: PlatformPermission[] = [
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
  "account_lifecycle",
];

export function buildSessionPermissions(
  role: PlatformRole
): Record<PlatformPermission, boolean> {
  return Object.fromEntries(
    ALL_PLATFORM_PERMISSIONS.map((permission) => [
      permission,
      hasPermission(role, permission),
    ])
  ) as Record<PlatformPermission, boolean>;
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

import { platformPathPrefix } from "./paths";

const PLATFORM_PREFIX = platformPathPrefix();

export function permissionForPath(pathname: string): PlatformPermission | null {
  if (!pathname.startsWith(PLATFORM_PREFIX)) return null;

  if (pathname.startsWith(`${PLATFORM_PREFIX}/finance`)) return "finance";
  if (pathname.startsWith(`${PLATFORM_PREFIX}/freight`)) return "freight";
  if (pathname.startsWith(`${PLATFORM_PREFIX}/parts`)) return "parts";
  if (pathname.startsWith(`${PLATFORM_PREFIX}/appointments`)) return "leads";
  if (pathname.startsWith(`${PLATFORM_PREFIX}/tracking`)) return "leads";
  if (pathname.startsWith(`${PLATFORM_PREFIX}/users`)) return "users";
  if (pathname.startsWith(`${PLATFORM_PREFIX}/site-content`)) return "site_content";
  if (pathname.startsWith(`${PLATFORM_PREFIX}/settings`)) return "settings";
  if (pathname.startsWith(`${PLATFORM_PREFIX}/reports`)) return "reports";
  if (pathname.startsWith(`${PLATFORM_PREFIX}/trash`)) return "trash";
  if (pathname.startsWith(`${PLATFORM_PREFIX}/account-lifecycle`)) return "account_lifecycle";
  if (pathname === `${PLATFORM_PREFIX}/inventory/new`) return "inventory_edit";
  if (new RegExp(`^${PLATFORM_PREFIX}/inventory/[^/]+/edit/?$`).test(pathname)) {
    return "inventory_edit";
  }
  if (pathname.startsWith(`${PLATFORM_PREFIX}/inventory/movements`)) return "inventory";
  if (pathname.startsWith(`${PLATFORM_PREFIX}/inventory`)) return "inventory";
  if (pathname.startsWith(`${PLATFORM_PREFIX}/customers`)) return "customers";
  if (pathname.startsWith(`${PLATFORM_PREFIX}/sales`)) return "sales";
  if (pathname.startsWith(`${PLATFORM_PREFIX}/leads`)) return "leads";
  if (pathname.startsWith(`${PLATFORM_PREFIX}/team-chat`)) return "team_messages";
  if (pathname.startsWith(`${PLATFORM_PREFIX}/messages`)) return "messages";
  if (pathname.startsWith(`${PLATFORM_PREFIX}/emails`)) return "emails";
  if (pathname.startsWith(`${PLATFORM_PREFIX}/documents`)) return "documents";
  if (
    pathname.startsWith(`${PLATFORM_PREFIX}/dashboard`) ||
    pathname === PLATFORM_PREFIX
  ) {
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
    "account-lifecycle": "account_lifecycle",
  };
  const segment = href.replace(`${PLATFORM_PREFIX}/`, "").split("/")[0];
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
    "account_lifecycle",
  ];

  return permissions.map((permission) => ({
    permission,
    owner: hasPermission("owner", permission),
    super_admin: hasPermission("super_admin", permission),
    manager: hasPermission("manager", permission),
    staff: hasPermission("staff", permission),
  }));
}
