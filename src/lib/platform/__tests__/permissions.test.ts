import { describe, expect, it } from "vitest";
import { PLATFORM_NAV } from "@/lib/platform/nav";
import {
  buildSessionPermissions,
  canInstallPlatformApp,
  hasPermission,
  navPermissionForHref,
  normalizeRole,
  permissionForPath,
  type PlatformRole,
} from "@/lib/platform/permissions";
import { platformPath } from "@/lib/platform/paths";

function visibleNavigationLabels(role: PlatformRole): string[] {
  const permissions = buildSessionPermissions(role);
  return PLATFORM_NAV.filter(
    (item) => permissions[navPermissionForHref(item.href)]
  ).map((item) => item.label);
}

describe("platform role navigation and authorization", () => {
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
    expect(normalizeRole("Sales Officer")).toBe("staff");
    expect(buildSessionPermissions(normalizeRole("Manager")).settings).toBe(false);
    expect(buildSessionPermissions(normalizeRole("Sales Officer")).settings).toBe(false);
    expect(canInstallPlatformApp(normalizeRole("Manager"))).toBe(true);
    expect(canInstallPlatformApp(normalizeRole("Sales Officer"))).toBe(true);
    expect(canInstallPlatformApp(normalizeRole("Viewer"))).toBe(true);
    expect(canInstallPlatformApp(normalizeRole("unrecognized-assigned-role"))).toBe(true);
  });
});
