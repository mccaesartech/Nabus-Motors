import { describe, expect, it } from "vitest";
import { PLATFORM_NAV } from "@/lib/platform/nav";
import {
  ALL_PLATFORM_PERMISSIONS,
  buildSessionPermissions,
  canInstallPlatformApp,
  canViewFinance,
  hasPermission,
  INVITABLE_ROLES,
  navPermissionForHref,
  normalizeRole,
  permissionForPath,
  PRODUCT_ROLES,
  type PlatformPermission,
  type PlatformRole,
} from "@/lib/platform/permissions";
import { platformPath } from "@/lib/platform/paths";

function visibleNavigationLabels(role: PlatformRole): string[] {
  const permissions = buildSessionPermissions(role);
  return PLATFORM_NAV.filter(
    (item) => permissions[navPermissionForHref(item.href)]
  ).map((item) => item.label);
}

const SYSTEM_PERMS: PlatformPermission[] = [
  "settings",
  "users",
  "site_content",
  "trash",
  "account_lifecycle",
  "inventory_approve",
  "activity",
  "audit_log",
  "mfa_enforce",
];

const MANAGER_OPS: PlatformPermission[] = [
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
];

const STAFF_OPS: PlatformPermission[] = [
  "dashboard",
  "inventory",
  "customers",
  "leads",
  "freight",
  "messages",
  "emails",
  "team_messages",
];

describe("platform role navigation and authorization", () => {
  it("exposes only product roles for invite / role assignment", () => {
    expect(PRODUCT_ROLES).toEqual(["owner", "super_admin", "manager", "staff"]);
    expect(INVITABLE_ROLES).toEqual(["super_admin", "manager", "staff"]);
    expect(INVITABLE_ROLES).not.toContain("administrator");
    expect(INVITABLE_ROLES).not.toContain("sales_officer");
    expect(INVITABLE_ROLES).not.toContain("inventory_officer");
    expect(INVITABLE_ROLES).not.toContain("freight_officer");
    expect(INVITABLE_ROLES).not.toContain("accounts");
    expect(INVITABLE_ROLES).not.toContain("owner");
  });

  it.each([
    ["owner", true],
    ["super_admin", true],
    ["manager", false],
    ["staff", false],
  ] as const)("%s settings access is %s", (role, expected) => {
    const permissions = buildSessionPermissions(role);
    const visibleLabels = visibleNavigationLabels(role);

    expect(permissions.settings).toBe(expected);
    expect(visibleLabels.includes("Settings")).toBe(expected);
  });

  it.each(["owner", "super_admin", "manager", "staff"] as const)(
    "shows the platform install action to %s",
    (role) => {
      expect(canInstallPlatformApp(role)).toBe(true);
    }
  );

  it("keeps direct Settings routes protected for assigned non-admin roles", () => {
    const requiredPermission = permissionForPath(platformPath("settings"));

    expect(requiredPermission).toBe("settings");
    expect(hasPermission("manager", requiredPermission!)).toBe(false);
    expect(hasPermission("staff", requiredPermission!)).toBe(false);
    expect(hasPermission("owner", requiredPermission!)).toBe(true);
    expect(hasPermission("super_admin", requiredPermission!)).toBe(true);
  });

  it("normalizes legacy assigned roles without elevating Settings access", () => {
    expect(normalizeRole("Manager")).toBe("manager");
    expect(normalizeRole("Sales Officer")).toBe("sales_officer");
    expect(buildSessionPermissions(normalizeRole("Manager")).settings).toBe(false);
    expect(buildSessionPermissions(normalizeRole("Sales Officer")).settings).toBe(false);
    expect(canInstallPlatformApp(normalizeRole("Manager"))).toBe(true);
    expect(canInstallPlatformApp(normalizeRole("Sales Officer"))).toBe(true);
    expect(canInstallPlatformApp(normalizeRole("Viewer"))).toBe(true);
    expect(canInstallPlatformApp(normalizeRole("unrecognized-assigned-role"))).toBe(true);
  });

  it("gives super_admin the same permission set as owner", () => {
    const owner = buildSessionPermissions("owner");
    const superAdmin = buildSessionPermissions("super_admin");
    for (const permission of ALL_PLATFORM_PERMISSIONS) {
      expect(superAdmin[permission]).toBe(owner[permission]);
    }
  });

  it("grants manager freight, inventory, and sales ops without system finance or settings", () => {
    for (const permission of MANAGER_OPS) {
      expect(hasPermission("manager", permission)).toBe(true);
    }
    expect(hasPermission("manager", "finance")).toBe(false);
    for (const permission of SYSTEM_PERMS) {
      expect(hasPermission("manager", permission)).toBe(false);
    }

    const labels = visibleNavigationLabels("manager");
    expect(labels).toEqual(
      expect.arrayContaining([
        "Reports",
        "Freight Orders",
        "Inventory",
        "Sales",
        "Customers",
      ])
    );
    expect(labels.includes("Finance")).toBe(false);
    expect(labels.includes("Settings")).toBe(false);
    expect(labels.includes("Users")).toBe(false);
    expect(labels.includes("Site Content")).toBe(false);
    expect(labels.includes("Trash")).toBe(false);
    expect(labels.includes("Audit Log")).toBe(false);
  });

  it("shows Audit Log only to owner and super_admin", () => {
    expect(permissionForPath(platformPath("audit-log"))).toBe("audit_log");
    expect(hasPermission("owner", "audit_log")).toBe(true);
    expect(hasPermission("super_admin", "audit_log")).toBe(true);
    expect(hasPermission("manager", "audit_log")).toBe(false);
    expect(visibleNavigationLabels("owner")).toContain("Audit Log");
    expect(visibleNavigationLabels("super_admin")).toContain("Audit Log");
    expect(visibleNavigationLabels("manager")).not.toContain("Audit Log");
  });

  it("keeps staff narrower than manager (no finance/sales edit/reports)", () => {
    for (const permission of STAFF_OPS) {
      expect(hasPermission("staff", permission)).toBe(true);
    }
    expect(hasPermission("staff", "sales")).toBe(false);
    expect(hasPermission("staff", "finance")).toBe(false);
    expect(hasPermission("staff", "inventory_edit")).toBe(false);
    expect(hasPermission("staff", "reports")).toBe(false);
    expect(hasPermission("staff", "parts")).toBe(false);
    expect(hasPermission("staff", "documents")).toBe(false);
    for (const permission of SYSTEM_PERMS) {
      expect(hasPermission("staff", permission)).toBe(false);
    }
  });

  it("allows account security path for every authenticated role", () => {
    expect(permissionForPath(platformPath("account/security"))).toBeNull();
    expect(permissionForPath(platformPath("account"))).toBeNull();
  });

  it("hides finance nav from manager and staff; staff also lacks sales/reports", () => {
    const managerLabels = visibleNavigationLabels("manager");
    const staffLabels = visibleNavigationLabels("staff");
    expect(managerLabels.includes("Finance")).toBe(false);
    expect(managerLabels).toEqual(expect.arrayContaining(["Sales", "Reports"]));
    expect(staffLabels.includes("Finance")).toBe(false);
    expect(staffLabels.includes("Sales")).toBe(false);
    expect(staffLabels.includes("Reports")).toBe(false);
    expect(staffLabels.includes("Users")).toBe(false);
    expect(staffLabels.includes("Settings")).toBe(false);
  });

  it("limits business finance visibility to owner and super_admin", () => {
    expect(canViewFinance("owner")).toBe(true);
    expect(canViewFinance("super_admin")).toBe(true);
    expect(canViewFinance("manager")).toBe(false);
    expect(canViewFinance("staff")).toBe(false);
    expect(canViewFinance("accounts")).toBe(false);
  });
});
