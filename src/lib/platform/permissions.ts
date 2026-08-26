/**
 * Product roles — the only roles owners may assign going forward.
 * Legacy IAM slugs remain in PLATFORM_ROLES for existing DB rows.
 */
export const PRODUCT_ROLES = [
  "owner",
  "super_admin",
  "manager",
  "staff",
] as const;

export type ProductRole = (typeof PRODUCT_ROLES)[number];

/** All recognized role slugs (product + legacy). Do not use for invite UI. */
export const PLATFORM_ROLES = [
  "owner",
  "super_admin",
  "manager",
  "staff",
  // Legacy IAM titles — permission fallbacks only; not assignable.
  "administrator",
  "sales_officer",
  "inventory_officer",
  "freight_officer",
  "accounts",
] as const;

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
  | "audit_log"
  | "trash"
  | "account_lifecycle"
  | "mfa_enforce";

export const ROLE_LABELS: Record<PlatformRole, string> = {
  owner: "Owner",
  super_admin: "Super Admin",
  manager: "Manager",
  staff: "Staff",
  // Legacy display labels for leftover DB rows
  administrator: "Administrator",
  sales_officer: "Sales Officer",
  inventory_officer: "Inventory Officer",
  freight_officer: "Freight Officer",
  accounts: "Accounts",
};

/**
 * Roles assignable via invite / role-change UI.
 * Owner is bootstrap-only (not invited). Legacy IAM roles are excluded.
 */
export const INVITABLE_ROLES: PlatformRole[] = [
  "super_admin",
  "manager",
  "staff",
];

export function isProductRole(role: string): role is ProductRole {
  return (PRODUCT_ROLES as readonly string[]).includes(role);
}

export function isAssignableRole(role: string): boolean {
  return (INVITABLE_ROLES as readonly string[]).includes(role);
}

const ALL_PERMS: PlatformPermission[] = [
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
  "audit_log",
  "trash",
  "account_lifecycle",
  "mfa_enforce",
];

/**
 * Role model (product):
 * - owner ≡ super_admin: full access including system changes, trash, and
 *   direct mutations (approve inventory; execute deletes/writes)
 * - manager: freight, inventory (+ edit for pending-approval submissions),
 *   sales, customers, reports, documents, parts, leads, messages — may VIEW
 *   these modules but must not delete or apply writes. System finance
 *   (revenue, expenses, profit) is owner/super_admin only.
 *   directly (except inventory pending_approval path). No settings/users/
 *   site_content/trash/account_lifecycle/inventory_approve/activity/
 *   audit_log/mfa_enforce
 * - staff: limited operational VIEW access (narrower than manager); zero
 *   permanent delete; no direct mutate without Owner/Super Admin approval
 *
 * Legacy officer/administrator/accounts maps kept so leftover DB rows keep working.
 */
const ROLE_PERMISSIONS: Record<PlatformRole, ReadonlySet<PlatformPermission>> = {
  owner: new Set(ALL_PERMS),
  super_admin: new Set(ALL_PERMS),
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
    "reports",
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
  // Legacy fallbacks (not assignable)
  administrator: new Set(ALL_PERMS.filter((p) => p !== "mfa_enforce" && p !== "audit_log")),
  sales_officer: new Set([
    "dashboard",
    "inventory",
    "customers",
    "sales",
    "leads",
    "messages",
    "emails",
    "team_messages",
  ]),
  inventory_officer: new Set([
    "dashboard",
    "inventory",
    "inventory_edit",
    "parts",
    "team_messages",
  ]),
  freight_officer: new Set([
    "dashboard",
    "freight",
    "leads",
    "customers",
    "messages",
    "team_messages",
  ]),
  accounts: new Set([
    "dashboard",
    "finance",
    "sales",
    "customers",
    "reports",
    "documents",
    "team_messages",
  ]),
};

const LEGACY_ROLE_MAP: Record<string, PlatformRole> = {
  owner: "owner",
  Owner: "owner",
  super_admin: "super_admin",
  "Super Admin": "super_admin",
  "Super Administrator": "super_admin",
  administrator: "administrator",
  Administrator: "administrator",
  manager: "manager",
  Manager: "manager",
  staff: "staff",
  Staff: "staff",
  sales_officer: "sales_officer",
  "Sales Officer": "sales_officer",
  inventory_officer: "inventory_officer",
  "Inventory Officer": "inventory_officer",
  freight_officer: "freight_officer",
  "Freight Officer": "freight_officer",
  accounts: "accounts",
  Accounts: "accounts",
  "Finance Officer": "accounts",
  Viewer: "staff",
};

export function normalizeRole(role: string | null | undefined): PlatformRole {
  if (!role) return "staff";
  return (
    LEGACY_ROLE_MAP[role] ??
    (PLATFORM_ROLES.includes(role as PlatformRole)
      ? (role as PlatformRole)
      : "staff")
  );
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
  "audit_log",
  "trash",
  "account_lifecycle",
  "mfa_enforce",
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

/** Business finance (revenue, expenses, profit) — owner and super_admin only. */
export function canViewFinance(role: PlatformRole): boolean {
  return role === "owner" || role === "super_admin";
}

export function canEditInventory(role: PlatformRole): boolean {
  return hasPermission(role, "inventory_edit");
}

export function canApproveInventory(role: PlatformRole): boolean {
  return hasPermission(role, "inventory_approve");
}

/** Export inventory data (vehicles, movement ledger, inventory reports) — staff excluded. */
export function canExportInventory(role: PlatformRole): boolean {
  if (role === "staff") return false;
  return hasPermission(role, "inventory");
}

/**
 * Create or update shipment tracking records (not delete).
 * Managers and legacy freight officers run day-to-day import/freight ops.
 */
export function canMutateFreight(role: PlatformRole): boolean {
  return (
    role === "owner" ||
    role === "super_admin" ||
    role === "administrator" ||
    role === "manager" ||
    role === "freight_officer"
  );
}

/** AI-assisted customer-visible shipment / freight notes — owners and managers only. */
export function canUseCustomerNoteAi(role: PlatformRole): boolean {
  return (
    role === "owner" ||
    role === "super_admin" ||
    role === "administrator" ||
    role === "manager"
  );
}

/** View all customer support tickets and reassign across staff. */
export function canOversightCustomerTickets(
  role: PlatformRole | "owner"
): boolean {
  return (
    role === "owner" ||
    role === "super_admin" ||
    role === "administrator" ||
    role === "manager"
  );
}

import { platformPathPrefix } from "./paths";

const PLATFORM_PREFIX = platformPathPrefix();

export function permissionForPath(pathname: string): PlatformPermission | null {
  if (!pathname.startsWith(PLATFORM_PREFIX)) return null;

  // Account self-service — any authenticated platform user (not Settings-gated).
  if (pathname.startsWith(`${PLATFORM_PREFIX}/account`)) return null;

  if (pathname.startsWith(`${PLATFORM_PREFIX}/finance`)) return "finance";
  // FX calculator — any authenticated platform user (same rates as price displays).
  if (pathname.startsWith(`${PLATFORM_PREFIX}/tools`)) return null;
  if (pathname.startsWith(`${PLATFORM_PREFIX}/freight`)) return "freight";
  if (pathname.startsWith(`${PLATFORM_PREFIX}/parts`)) return "parts";
  if (pathname.startsWith(`${PLATFORM_PREFIX}/appointments`)) return "leads";
  if (pathname.startsWith(`${PLATFORM_PREFIX}/tracking`)) return "leads";
  if (pathname.startsWith(`${PLATFORM_PREFIX}/users`)) return "users";
  if (pathname.startsWith(`${PLATFORM_PREFIX}/site-content`)) return "site_content";
  if (pathname.startsWith(`${PLATFORM_PREFIX}/settings`)) return "settings";
  if (pathname.startsWith(`${PLATFORM_PREFIX}/reports`)) return "reports";
  if (pathname.startsWith(`${PLATFORM_PREFIX}/trash`)) return "trash";
  if (pathname.startsWith(`${PLATFORM_PREFIX}/audit-log`)) return "audit_log";
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
    tools: "dashboard",
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
    "audit-log": "audit_log",
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
    "audit_log",
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
