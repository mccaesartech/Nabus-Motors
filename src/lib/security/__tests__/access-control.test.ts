import { describe, expect, it, vi } from "vitest";

vi.mock("next/headers", () => ({
  cookies: async () => ({ get: () => undefined }),
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminSupabase: () => null,
}));

import {
  hasPermission,
  INVITABLE_ROLES,
  type PlatformPermission,
  type PlatformRole,
} from "@/lib/platform/permissions";
import {
  canDeleteCustomer,
  canManageTrash,
  canPermanentlyDeleteTrash,
  canViewInviteLinks,
  isPlatformOwnerActor,
  type PlatformAuthContext,
} from "@/lib/admin/auth";
import {
  isBearerAuthorizationHeader,
  roleAssignmentDenial,
} from "@/lib/security/role-guards";

function auth(
  partial: Pick<PlatformAuthContext, "type" | "role"> &
    Partial<PlatformAuthContext>
): PlatformAuthContext {
  return {
    name: "Test",
    email: "test@example.com",
    ...partial,
  };
}

describe("Broken access control / missing authorization", () => {
  it("staff cannot reach privileged permissions", () => {
    const privileged: PlatformPermission[] = [
      "users",
      "settings",
      "finance",
      "trash",
      "mfa_enforce",
      "inventory_approve",
    ];
    for (const permission of privileged) {
      expect(hasPermission("staff", permission)).toBe(false);
    }
  });

  it("manager cannot manage users, settings, or business finance", () => {
    expect(hasPermission("manager", "users")).toBe(false);
    expect(hasPermission("manager", "settings")).toBe(false);
    expect(hasPermission("manager", "finance")).toBe(false);
    expect(hasPermission("manager", "inventory_approve")).toBe(false);
  });

  it("owner role cannot be invited — bootstrap only", () => {
    expect(INVITABLE_ROLES).not.toContain("owner");
  });

  it("super_admin cannot self-escalate to owner via role assignment policy", () => {
    expect(
      roleAssignmentDenial({
        actorIsOwner: false,
        requestedRole: "owner",
      })
    ).toMatch(/only the owner/i);

    expect(
      roleAssignmentDenial({
        actorIsOwner: false,
        requestedRole: "super_admin",
      })
    ).toMatch(/super admin/i);

    expect(
      roleAssignmentDenial({
        actorIsOwner: false,
        targetRole: "owner",
        modifyingIdentityFields: true,
      })
    ).toMatch(/modify an owner/i);

    expect(
      roleAssignmentDenial({
        actorIsOwner: true,
        requestedRole: "owner",
      })
    ).toBeNull();
  });

  it("owner helpers distinguish bootstrap owner from staff", () => {
    const owner = auth({ type: "owner", role: "owner" });
    const staff = auth({ type: "user", role: "staff", userId: "u1" });
    const superAdmin = auth({ type: "user", role: "super_admin", userId: "u2" });
    const manager = auth({ type: "user", role: "manager", userId: "u3" });

    expect(isPlatformOwnerActor(owner)).toBe(true);
    expect(isPlatformOwnerActor(staff)).toBe(false);
    expect(isPlatformOwnerActor(superAdmin)).toBe(false);

    expect(canViewInviteLinks(owner)).toBe(true);
    expect(canViewInviteLinks(superAdmin)).toBe(true);
    expect(canViewInviteLinks(staff)).toBe(false);

    expect(canDeleteCustomer(staff)).toBe(false);
    expect(canDeleteCustomer(manager)).toBe(false);
    expect(canDeleteCustomer(superAdmin)).toBe(true);
  });

  it("staff and manager cannot permanently delete trash", () => {
    const staff = auth({ type: "user", role: "staff", userId: "u1" });
    const manager = auth({ type: "user", role: "manager", userId: "u3" });
    const superAdmin = auth({ type: "user", role: "super_admin", userId: "u2" });

    expect(canManageTrash(staff)).toBe(false);
    expect(canManageTrash(manager)).toBe(false);
    expect(canPermanentlyDeleteTrash(staff)).toBe(false);
    expect(canPermanentlyDeleteTrash(manager)).toBe(false);
    expect(canPermanentlyDeleteTrash(superAdmin)).toBe(true);
  });

  it("rejects missing or non-Bearer authorization headers", () => {
    expect(isBearerAuthorizationHeader(null)).toBe(false);
    expect(isBearerAuthorizationHeader("")).toBe(false);
    expect(isBearerAuthorizationHeader("Basic abc")).toBe(false);
    expect(isBearerAuthorizationHeader("Bearer ")).toBe(false);
    expect(isBearerAuthorizationHeader("Bearer token-value")).toBe(true);
  });

  it.each<[PlatformRole, PlatformPermission, boolean]>([
    ["staff", "dashboard", true],
    ["staff", "users", false],
    ["manager", "sales", true],
    ["manager", "users", false],
    ["super_admin", "users", true],
    ["owner", "mfa_enforce", true],
  ])("%s hasPermission(%s) === %s", (role, permission, expected) => {
    expect(hasPermission(role, permission)).toBe(expected);
  });
});
