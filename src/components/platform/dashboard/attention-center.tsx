"use client";

import Link from "next/link";
import {
  AlertTriangle,
  CreditCard,
  MessageSquare,
  Package,
  Ship,
  ShoppingBag,
} from "lucide-react";
import { EmptyState } from "@/components/platform/dashboard/empty-state";
import { semanticToneClasses, type SemanticTone } from "@/lib/platform/design-tokens";
import { platformPath } from "@/lib/platform/paths";
import type { PlatformStats } from "@/lib/platform/types";
import type { AdminNotification } from "@/lib/platform/types";
import type { PlatformPermission, PlatformRole } from "@/lib/platform/permissions";
import { canViewFinance } from "@/lib/platform/permissions";
import { cn } from "@/lib/utils";

type AttentionItem = {
  id: string;
  label: string;
  count: number;
  href: string;
  icon: typeof AlertTriangle;
  severity: SemanticTone;
};

type AttentionCenterProps = {
  stats: PlatformStats | null;
  notifications: AdminNotification[];
  permissions: Record<PlatformPermission, boolean>;
  role: PlatformRole;
  extras?: {
    pendingShipments?: number;
    delayedShipments?: number;
    failedPayments?: number;
  };
};

function buildAttentionItems(
  stats: PlatformStats | null,
  notifications: AdminNotification[],
  permissions: Record<PlatformPermission, boolean>,
  role: PlatformRole,
  extras: AttentionCenterProps["extras"] = {}
): AttentionItem[] {
  if (!stats) return [];

  const financeVisible = canViewFinance(role);

  const unread = notifications.filter((n) => !n.readAt).length;
  const items: AttentionItem[] = [];

  if (stats.totalLeads > 0 && permissions.leads) {
    items.push({
      id: "open-leads",
      label: "Open leads",
      count: stats.totalLeads,
      href: `${platformPath("leads")}?status=new`,
      icon: MessageSquare,
      severity: "danger",
    });
  }

  if ((stats.newPreorder ?? 0) > 0 && permissions.leads) {
    items.push({
      id: "pending-preorders",
      label: "Pending pre-orders",
      count: stats.newPreorder ?? 0,
      href: `${platformPath("leads")}?tab=preorder`,
      icon: ShoppingBag,
      severity: "warning",
    });
  }

  if ((extras?.delayedShipments ?? 0) > 0 && permissions.freight) {
    items.push({
      id: "delayed-shipments",
      label: "Delayed shipments",
      count: extras.delayedShipments!,
      href: platformPath("freight/tracking"),
      icon: Ship,
      severity: "danger",
    });
  } else if ((extras?.pendingShipments ?? 0) > 0 && permissions.freight) {
    items.push({
      id: "pending-shipments",
      label: "Pending shipments",
      count: extras.pendingShipments!,
      href: platformPath("freight/orders"),
      icon: Ship,
      severity: "warning",
    });
  }

  if (stats.lowStock && permissions.inventory) {
    items.push({
      id: "low-stock",
      label: "Low stock — add or import vehicles",
      count: Math.max(stats.availableVehicles, 1),
      href: `${platformPath("inventory")}?stock=low`,
      icon: Package,
      severity: "danger",
    });
  }

  if (unread > 0) {
    items.push({
      id: "unread-messages",
      label: "Unread notifications",
      count: unread,
      href: platformPath("notifications"),
      icon: MessageSquare,
      severity: "info",
    });
  }

  if ((stats.pendingFinance ?? 0) > 0 && financeVisible) {
    items.push({
      id: "pending-finance",
      label: "Pending finance applications",
      count: stats.pendingFinance,
      href: platformPath("finance"),
      icon: CreditCard,
      severity: "warning",
    });
  }

  if ((extras?.failedPayments ?? 0) > 0 && financeVisible) {
    items.push({
      id: "failed-payments",
      label: "Failed payments",
      count: extras.failedPayments!,
      href: `${platformPath("leads")}?tab=preorder`,
      icon: AlertTriangle,
      severity: "danger",
    });
  }

  const severityOrder: Record<SemanticTone, number> = {
    danger: 0,
    warning: 1,
    info: 2,
    success: 3,
    neutral: 4,
  };
  return items.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);
}

export function AttentionCenter({
  stats,
  notifications,
  permissions,
  role,
  extras,
}: AttentionCenterProps) {
  const items = buildAttentionItems(stats, notifications, permissions, role, extras);

  return (
    <section aria-label="Attention center" className="space-y-2.5">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold text-[var(--platform-text)]">Attention center</h2>
        <Link
          href={platformPath("notifications")}
          className="text-xs font-medium text-[var(--platform-accent)] transition-opacity hover:underline"
        >
          View all
        </Link>
      </div>

      {items.length === 0 ? (
        <div className="platform-dashboard-card rounded-xl">
          <EmptyState
            title="All clear"
            description="No urgent issues or pending tasks right now. You're on top of things."
          />
        </div>
      ) : (
        <ul className="grid min-w-0 gap-2.5 sm:grid-cols-2 lg:grid-cols-[repeat(auto-fill,minmax(min(100%,260px),1fr))]">
          {items.map((item) => {
            const Icon = item.icon;
            const tone = semanticToneClasses[item.severity];
            return (
              <li key={item.id}>
                <Link
                  href={item.href}
                  className={cn(
                    "platform-dashboard-card flex items-center gap-3 rounded-xl border p-3.5",
                    tone.bg,
                    tone.border
                  )}
                >
                  <span
                    className={cn(
                      "flex size-10 shrink-0 items-center justify-center rounded-lg bg-white/80",
                      tone.text
                    )}
                  >
                    <Icon className="size-4" aria-hidden />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-medium text-[var(--platform-text)]">
                      {item.label}
                    </span>
                    <span className="text-xs text-[var(--platform-text-secondary)]">
                      {item.count} item{item.count !== 1 ? "s" : ""} need attention
                    </span>
                  </span>
                  <span
                    className={cn(
                      "flex size-8 shrink-0 items-center justify-center rounded-full bg-white/90 text-sm font-semibold tabular-nums",
                      tone.text
                    )}
                  >
                    {item.count}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
