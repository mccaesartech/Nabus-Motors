"use client";

import Link from "next/link";
import {
  Calendar,
  Car,
  MessageSquarePlus,
  Package,
  Ship,
  UserPlus,
} from "lucide-react";
import { platformPath } from "@/lib/platform/paths";
import type { PlatformPermission } from "@/lib/platform/permissions";

type QuickAction = {
  label: string;
  description: string;
  href: string;
  icon: typeof Car;
  permission?: PlatformPermission;
};

const QUICK_ACTIONS: QuickAction[] = [
  {
    label: "Add vehicle",
    description: "List a new car for sale",
    href: platformPath("inventory/new"),
    icon: Car,
    permission: "inventory_edit",
  },
  {
    label: "Add spare part",
    description: "Expand parts catalogue",
    href: platformPath("parts/inventory"),
    icon: Package,
    permission: "parts",
  },
  {
    label: "Create shipment",
    description: "Start freight tracking",
    href: platformPath("freight/orders"),
    icon: Ship,
    permission: "freight",
  },
  {
    label: "Create quote",
    description: "Review freight quote requests",
    href: platformPath("freight/quotes"),
    icon: MessageSquarePlus,
    permission: "freight",
  },
  {
    label: "Create customer",
    description: "View customer directory",
    href: platformPath("customers"),
    icon: UserPlus,
    permission: "customers",
  },
  {
    label: "Schedule appointment",
    description: "Viewings & test drives",
    href: platformPath("appointments"),
    icon: Calendar,
    permission: "leads",
  },
];

type QuickActionsProps = {
  permissions: Record<PlatformPermission, boolean>;
};

export function QuickActions({ permissions }: QuickActionsProps) {
  const actions = QUICK_ACTIONS.filter(
    (a) => !a.permission || permissions[a.permission]
  );

  if (actions.length === 0) return null;

  return (
    <section aria-label="Quick actions" className="space-y-3">
      <h2 className="text-sm font-semibold text-[var(--platform-text)]">Quick actions</h2>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {actions.map((action) => {
          const Icon = action.icon;
          return (
            <Link
              key={action.href}
              href={action.href}
              className="platform-dashboard-card platform-card group flex items-center gap-4 rounded-xl p-4 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--platform-accent)]"
            >
              <span className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-[rgba(139,92,246,0.12)] text-[var(--platform-accent)]">
                <Icon className="size-5" aria-hidden />
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-semibold text-[var(--platform-text)]">
                  {action.label}
                </span>
                <span className="text-xs text-[var(--platform-text-secondary)]">
                  {action.description}
                </span>
              </span>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
