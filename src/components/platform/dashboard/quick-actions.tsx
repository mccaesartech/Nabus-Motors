"use client";

import { Car, ShoppingBag, UserPlus } from "lucide-react";
import { NabusQuickActions } from "@/components/nabus/nabus-quick-actions";
import { platformPath } from "@/lib/platform/paths";
import type { PlatformPermission, PlatformRole } from "@/lib/platform/permissions";
import { canDirectMutate } from "@/lib/platform/mutation-approval";

type QuickActionsProps = {
  permissions: Record<PlatformPermission, boolean>;
  role: PlatformRole;
};

export function QuickActions({ permissions, role }: QuickActionsProps) {
  const directMutate = canDirectMutate(role);

  const actions = [
    permissions.inventory_edit || directMutate
      ? {
          label: "Add Vehicle",
          href: platformPath("inventory/new"),
          icon: Car,
          variant: "primary" as const,
        }
      : null,
    permissions.customers
      ? {
          label: "Add Customer",
          href: platformPath("customers"),
          icon: UserPlus,
          variant: "secondary" as const,
        }
      : null,
    permissions.leads || permissions.sales
      ? {
          label: "New Order",
          href: platformPath("leads?tab=order"),
          icon: ShoppingBag,
          variant: "secondary" as const,
        }
      : null,
  ].filter(Boolean) as Array<{
    label: string;
    href: string;
    icon: typeof Car;
    variant: "primary" | "secondary" | "gold";
  }>;

  if (actions.length === 0) return null;

  return (
    <section aria-label="Quick actions" className="space-y-3">
      <h2 className="text-sm font-semibold text-[var(--platform-text)]">Quick actions</h2>
      <NabusQuickActions actions={actions.slice(0, 3)} />
    </section>
  );
}
