"use client";

import Link from "next/link";
import {
  AlertTriangle,
  Bell,
  Car,
  CreditCard,
  MessageSquare,
  Package,
  ShoppingBag,
  Ship,
  Trash2,
} from "lucide-react";
import { PageHeader } from "@/components/platform/page-header";
import { ConfirmDialog } from "@/components/platform/confirm-dialog";
import { PaymentStatusBadge } from "@/components/platform/status-badge";
import { PreorderNotificationPreview } from "@/components/platform/preorder-notification-preview";
import {
  AdminNotificationBody,
  adminNotificationHref,
  adminNotificationLinkLabel,
} from "@/components/platform/admin-notification-body";
import { useAdminNotifications } from "@/context/admin-notifications-context";
import { formatAdminNotificationForDisplay } from "@/lib/platform/notification-display";
import { parsePreorderMetadata } from "@/lib/platform/preorder";
import type { AdminNotification } from "@/lib/platform/types";
import { cn } from "@/lib/utils";
import { PlatformDateTime } from "@/components/platform/platform-datetime";
import { useEffect, useState } from "react";

const TYPE_ICONS: Record<string, typeof Bell> = {
  preorder: ShoppingBag,
  vehicle: Car,
  contact: MessageSquare,
  finance: CreditCard,
  appraisal: Package,
  low_stock: AlertTriangle,
  team_message: MessageSquare,
  delivery_deferred: AlertTriangle,
  delivery_failed: AlertTriangle,
};

export default function NotificationsPage() {
  const { notifications, unreadCount, load, markRead, markAllRead } = useAdminNotifications();
  const [loading, setLoading] = useState(true);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  useEffect(() => {
    void load().finally(() => setLoading(false));
  }, [load]);

  async function deleteNotification(id: string) {
    const res = await fetch(`/api/admin/notifications?id=${encodeURIComponent(id)}`, {
      method: "DELETE",
    });
    if (res.ok) {
      setDeleteId(null);
      await load();
    }
  }

  function handleOpenNotification(notification: AdminNotification) {
    if (!notification.readAt && notification.id !== "low-stock") {
      void markRead(notification.id);
    }
  }

  if (loading) {
    return <p className="text-sm text-[var(--platform-text-secondary)]">Loading notifications…</p>;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Notifications"
        description="Alerts for new leads, pre-orders, and items needing your attention."
        breadcrumb="Platform"
        actions={
          unreadCount > 0 ? (
            <button type="button" onClick={() => void markAllRead()} className="platform-btn-ghost">
              Mark all read
            </button>
          ) : undefined
        }
      />

      <div className="platform-card overflow-hidden rounded-xl">
        {notifications.length === 0 ? (
          <p className="px-5 py-12 text-center text-sm text-[var(--platform-text-secondary)]">
            You&apos;re all caught up — no notifications yet.
          </p>
        ) : (
          <ul>
            {notifications.map((n) => {
              const Icon = TYPE_ICONS[n.type] ?? Bell;
              const display = formatAdminNotificationForDisplay(n);
              const href = adminNotificationHref(n);
              const viewLabel = adminNotificationLinkLabel(n);
              const preorderMeta = n.type === "preorder" ? parsePreorderMetadata(n.metadata) : null;
              const isPreorder = n.type === "preorder" && preorderMeta;
              const isDelivery =
                n.type === "delivery_failed" || n.type === "delivery_deferred";

              return (
                <li
                  key={n.id}
                  className={cn(
                    "border-b border-[var(--platform-border)] px-4 py-4 last:border-0 sm:px-5",
                    !n.readAt && "bg-[rgba(139,92,246,0.04)]"
                  )}
                >
                  <button
                    type="button"
                    onClick={() => handleOpenNotification(n)}
                    className="flex w-full items-start gap-3 text-left sm:gap-4"
                  >
                    <span
                      className={cn(
                        "flex size-10 shrink-0 items-center justify-center rounded-lg",
                        !n.readAt
                          ? "bg-[rgba(139,92,246,0.15)] text-[var(--platform-accent)]"
                          : "bg-[var(--platform-bg)] text-[var(--platform-text-secondary)]"
                      )}
                    >
                      <Icon className="size-5" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                        <p className="text-sm font-medium leading-snug text-[var(--platform-text)] sm:text-base">
                          {display.title}
                        </p>
                        {!n.readAt && (
                          <span className="rounded-full bg-[var(--platform-accent)] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">
                            New
                          </span>
                        )}
                        {preorderMeta?.paymentStatus && (
                          <PaymentStatusBadge status={preorderMeta.paymentStatus} />
                        )}
                      </div>
                      {!isPreorder && !isDelivery && (
                        <p className="mt-1 text-sm leading-relaxed text-[var(--platform-text-secondary)]">
                          {display.message}
                        </p>
                      )}
                      {!isPreorder && isDelivery && (
                        <AdminNotificationBody notification={n} variant="full" className="mt-2" />
                      )}
                      {isPreorder && (
                        <PreorderNotificationPreview notification={n} variant="full" />
                      )}
                      <p className="mt-2 text-xs text-[var(--platform-text-secondary)]">
                        <PlatformDateTime value={n.createdAt} className="text-xs" />
                      </p>
                    </div>
                  </button>

                  <div className="mt-3 flex items-center gap-2 border-t border-[var(--platform-border)] pt-3 sm:ml-14">
                    <Link
                      href={href}
                      onClick={() => handleOpenNotification(n)}
                      className="inline-flex min-h-10 flex-1 items-center justify-center rounded-lg bg-[rgba(139,92,246,0.1)] px-3 text-sm font-medium text-[var(--platform-accent)] transition-colors hover:bg-[rgba(139,92,246,0.15)] sm:flex-none sm:px-4"
                    >
                      {viewLabel}
                    </Link>
                    {!n.readAt && n.id !== "low-stock" && (
                      <button
                        type="button"
                        onClick={() => void markRead(n.id)}
                        className="inline-flex min-h-10 flex-1 items-center justify-center rounded-lg border border-[var(--platform-border)] px-3 text-sm text-[var(--platform-text-secondary)] transition-colors hover:bg-[var(--platform-bg)] hover:text-[var(--platform-text)] sm:flex-none sm:px-4"
                      >
                        Mark read
                      </button>
                    )}
                    {n.id !== "low-stock" && (
                      <button
                        type="button"
                        onClick={() => setDeleteId(n.id)}
                        aria-label="Delete notification"
                        className="inline-flex size-10 shrink-0 items-center justify-center rounded-lg border border-[var(--platform-border)] text-[var(--platform-text-secondary)] transition-colors hover:border-[var(--platform-error)] hover:bg-[rgba(220,38,38,0.06)] hover:text-[var(--platform-error)]"
                      >
                        <Trash2 className="size-4" />
                      </button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <ConfirmDialog
        open={Boolean(deleteId)}
        onOpenChange={(open) => {
          if (!open) setDeleteId(null);
        }}
        title="Delete notification?"
        description="Remove this alert from your notification list?"
        confirmLabel="Delete"
        destructive
        onConfirm={async () => {
          if (deleteId) await deleteNotification(deleteId);
        }}
      />
    </div>
  );
}
