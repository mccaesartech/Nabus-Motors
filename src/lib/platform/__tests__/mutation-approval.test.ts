import { describe, expect, it, vi } from "vitest";

vi.mock("next/headers", () => ({
  cookies: async () => ({ get: () => undefined }),
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminSupabase: () => null,
}));

import {
  canDirectMutate,
  mutationRequiresApproval,
  MUTATION_APPROVAL_REQUIRED_MESSAGE,
} from "@/lib/platform/mutation-approval";
import {
  canApproveInventory,
  defaultApprovalStatusForCreate,
  managerNeedsApproval,
} from "@/lib/admin/vehicle-approval";
import {
  canManageTrash,
  canPermanentlyDeleteTrash,
  type PlatformAuthContext,
} from "@/lib/admin/auth";
import { hasPermission } from "@/lib/platform/permissions";

function auth(
  partial: Pick<PlatformAuthContext, "type" | "role"> & Partial<PlatformAuthContext>
): PlatformAuthContext {
  return {
    name: "Test",
    email: "test@example.com",
    ...partial,
  };
}

describe("mutation approval hierarchy", () => {
  it("allows only owner/super_admin/administrator to mutate directly", () => {
    expect(canDirectMutate("owner")).toBe(true);
    expect(canDirectMutate("super_admin")).toBe(true);
    expect(canDirectMutate("administrator")).toBe(true);
    expect(canDirectMutate("manager")).toBe(false);
    expect(canDirectMutate("staff")).toBe(false);
    expect(canDirectMutate("sales_officer")).toBe(false);
  });

  it("requires approval for manager, staff, and legacy officer roles", () => {
    expect(mutationRequiresApproval("manager")).toBe(true);
    expect(mutationRequiresApproval("staff")).toBe(true);
    expect(mutationRequiresApproval("inventory_officer")).toBe(true);
    expect(mutationRequiresApproval("owner")).toBe(false);
    expect(mutationRequiresApproval("super_admin")).toBe(false);
  });

  it("routes non-admin inventory creates into pending_approval", () => {
    expect(managerNeedsApproval("manager")).toBe(true);
    expect(managerNeedsApproval("staff")).toBe(true);
    expect(managerNeedsApproval("owner")).toBe(false);
    expect(defaultApprovalStatusForCreate("manager")).toBe("pending_approval");
    expect(defaultApprovalStatusForCreate("super_admin")).toBe("approved");
  });

  it("restricts inventory approval to owner/super_admin permission", () => {
    expect(canApproveInventory("owner")).toBe(true);
    expect(canApproveInventory("super_admin")).toBe(true);
    expect(canApproveInventory("manager")).toBe(false);
    expect(canApproveInventory("staff")).toBe(false);
  });

  it("denies staff and manager permanent trash delete and trash manage", () => {
    const staff = auth({ type: "user", role: "staff", userId: "s1" });
    const manager = auth({ type: "user", role: "manager", userId: "m1" });
    const owner = auth({ type: "owner", role: "owner" });
    const superAdmin = auth({ type: "user", role: "super_admin", userId: "sa1" });

    expect(hasPermission("staff", "trash")).toBe(false);
    expect(hasPermission("manager", "trash")).toBe(false);
    expect(canManageTrash(staff)).toBe(false);
    expect(canManageTrash(manager)).toBe(false);
    expect(canManageTrash(owner)).toBe(true);
    expect(canManageTrash(superAdmin)).toBe(true);

    expect(canPermanentlyDeleteTrash(staff)).toBe(false);
    expect(canPermanentlyDeleteTrash(manager)).toBe(false);
    expect(canPermanentlyDeleteTrash(owner)).toBe(true);
    expect(canPermanentlyDeleteTrash(superAdmin)).toBe(true);
  });

  it("exposes a clear denial message for blocked direct mutations", () => {
    expect(MUTATION_APPROVAL_REQUIRED_MESSAGE).toMatch(/Owner or Super Admin/i);
  });
});
