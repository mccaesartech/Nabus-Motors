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
import {
  ConfirmDialog,
  DELETE_CONFIRM_PHRASE,
} from "@/components/platform/confirm-dialog";
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
import { useEffect, useMemo, useState } from "react";

const TYPE_ICONS: Record<string, typeof Bell> = {
  preorder: ShoppingBag,
  vehicle: Car,
  contact: MessageSquare,
  finance: CreditCard,
  appraisal: Package,
  low_stock: AlertTriangle,
  team_message: MessageSquare,
  vehicle_stock_action: Package,
  delivery_deferred: AlertTriangle,
  delivery_failed: AlertTriangle,
};

function canDeleteNotification(n: AdminNotification): boolean {
  return n.id !== "low-stock";
}

export default function NotificationsPage() {
  const {
    notifications,
    unreadCount,
    load,
    markRead,
    markAllRead,
    removeLocal,
    restoreLocal,
    confirmRemoved,
  } = useAdminNotifications();
  const [loading, setLoading] = useState(true);
  const [deleteTarget, setDeleteTarget] = useState<AdminNotification | null>(null);
  const [bulkDeleteConfirm, setBulkDeleteConfirm] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [deleting, setDeleting] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [toastError, setToastError] = useState(false);

  useEffect(() => {
    void load().finally(() => setLoading(false));
  }, [load]);

  const deletableNotifications = useMemo(
    () => notifications.filter(canDeleteNotification),
    [notifications]
  );

  const allDeletableSelected =
    deletableNotifications.length > 0 &&
    deletableNotifications.every((n) => selectedIds.has(n.id));

  async function deleteNotifications(targets: AdminNotification[]) {
    const rollback = targets.filter((n) => n.id !== "low-stock");
    const ids = rollback.map((n) => n.id);
    if (ids.length === 0) return;

    const snapshots: Record<string, Record<string, unknown>> = {};
    for (const n of rollback) {
      snapshots[n.id] = {
        id: n.id,
        type: n.type,
        title: n.title,
        message: n.message,
        link: n.link,
        source_table: n.sourceTable,
        source_id: n.sourceId,
        read_at: n.readAt,
        created_at: n.createdAt,
        metadata: n.metadata ?? null,
      };
    }

    // Close dialog + optimistic remove immediately (match inventory trash).
    setDeleteTarget(null);
    setBulkDeleteConfirm(false);
    removeLocal(ids);
    setSelectedIds((prev) => {
      const next = new Set(prev);
      for (const id of ids) next.delete(id);
      return next;
    });
    setDeleting(true);
    setToastError(false);
    setToast(
      ids.length === 1
        ? "Moving notification to trash…"
        : `Moving ${ids.length} notifications to trash…`
    );

    try {
      const res = await fetch("/api/admin/notifications", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids, snapshots }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        restoreLocal(rollback);
        setToastError(true);
        setToast(json.message ?? "Could not delete notification(s).");
        return;
      }

      const deleted = (
        Array.isArray(json.deletedIds) ? json.deletedIds.map(String) : ids
      ) as string[];
      const deletedSet = new Set(deleted);
      const failedRollback = rollback.filter((n) => !deletedSet.has(n.id));
      if (failedRollback.length > 0) {
        restoreLocal(failedRollback);
      }
      confirmRemoved(deleted);
      setToastError(failedRollback.length > 0);
      setToast(
        json.message ??
          (deleted.length === 1
            ? "Notification moved to trash."
            : `${deleted.length} notifications moved to trash.`)
      );
      void load();
    } catch {
      restoreLocal(rollback);
      setToastError(true);
      setToast("Could not delete notification(s).");
    } finally {
      setDeleting(false);
    }
  }

  function toggleSelected(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    if (allDeletableSelected) {
      setSelectedIds(new Set());
      return;
    }
    setSelectedIds(new Set(deletableNotifications.map((n) => n.id)));
  }

  function handleOpenNotification(notification: AdminNotification) {
    if (!notification.readAt && notification.id !== "low-stock") {
      void markRead(notification.id);
    }
  }

  if (loading) {
    return <p className="text-sm text-[var(--platform-text-secondary)]">Loading notifications…</p>;
  }

  const selectedTargets = notifications.filter((n) => selectedIds.has(n.id));

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

      {toast && (
        <div
          role="status"
          className={cn(
            "rounded-lg border px-4 py-3 text-sm",
            toastError
              ? "border-red-500/40 bg-red-500/10 text-red-800"
              : "border-[var(--platform-success)]/30 bg-[rgba(16,185,129,0.08)] text-[var(--platform-success)]"
          )}
        >
          {toast}
        </div>
      )}

      {selectedIds.size > 0 && (
        <div className="flex flex-wrap items-center gap-3 rounded-lg border border-[var(--platform-border)] bg-[var(--platform-surface)] px-4 py-3 text-sm">
          <span>
            <span className="font-medium">{selectedIds.size}</span> selected
          </span>
          <button
            type="button"
            className="platform-btn-secondary inline-flex items-center gap-2 text-xs text-red-700"
            disabled={deleting}
            onClick={() => setBulkDeleteConfirm(true)}
          >
            <Trash2 className="size-3.5" />
            Move to trash
          </button>
          <button
            type="button"
            className="platform-btn-ghost text-xs"
            disabled={deleting}
            onClick={() => setSelectedIds(new Set())}
          >
            Clear selection
          </button>
        </div>
      )}

      <div className="platform-card overflow-hidden rounded-xl">
        {notifications.length === 0 ? (
          <p className="px-5 py-12 text-center text-sm text-[var(--platform-text-secondary)]">
            You&apos;re all caught up — no notifications yet.
          </p>
        ) : (
          <>
            {deletableNotifications.length > 0 && (
              <div className="flex items-center gap-2 border-b border-[var(--platform-border)] px-4 py-3 text-xs text-[var(--platform-text-secondary)] sm:px-5">
                <label className="inline-flex cursor-pointer items-center gap-1.5">
                  <input
                    type="checkbox"
                    checked={allDeletableSelected}
                    onChange={toggleSelectAll}
                    className="size-3.5 rounded border-[var(--platform-border)]"
                    aria-label="Select all notifications"
                  />
                  Select all
                </label>
              </div>
            )}
            <ul>
              {notifications.map((n) => {
                const Icon = TYPE_ICONS[n.type] ?? Bell;
                const display = formatAdminNotificationForDisplay(n);
                const href = adminNotificationHref(n);
                const viewLabel = adminNotificationLinkLabel(n);
                const preorderMeta =
                  n.type === "preorder" ? parsePreorderMetadata(n.metadata) : null;
                const isPreorder = n.type === "preorder" && preorderMeta;
                const isDelivery =
                  n.type === "delivery_failed" || n.type === "delivery_deferred";
                const deletable = canDeleteNotification(n);

                return (
                  <li
                    key={n.id}
                    className={cn(
                      "border-b border-[var(--platform-border)] px-4 py-4 last:border-0 sm:px-5",
                      !n.readAt && "bg-[rgba(139,92,246,0.04)]"
                    )}
                  >
                    <div className="flex items-start gap-3 sm:gap-4">
                      {deletable && (
                        <input
                          type="checkbox"
                          checked={selectedIds.has(n.id)}
                          onChange={() => toggleSelected(n.id)}
                          className="mt-3 size-3.5 shrink-0 rounded border-[var(--platform-border)]"
                          aria-label={`Select ${display.title}`}
                        />
                      )}
                      <button
                        type="button"
                        onClick={() => handleOpenNotification(n)}
                        className="flex min-w-0 flex-1 items-start gap-3 text-left sm:gap-4"
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
                            <AdminNotificationBody
                              notification={n}
                              variant="full"
                              className="mt-2"
                            />
                          )}
                          {isPreorder && (
                            <PreorderNotificationPreview notification={n} variant="full" />
                          )}
                          <p className="mt-2 text-xs text-[var(--platform-text-secondary)]">
                            <PlatformDateTime value={n.createdAt} className="text-xs" />
                          </p>
                        </div>
                      </button>
                    </div>

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
                      {deletable && (
                        <button
                          type="button"
                          onClick={() => setDeleteTarget(n)}
                          aria-label="Delete notification"
                          disabled={deleting}
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
          </>
        )}
      </div>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
        title={
          deleteTarget
            ? `Delete “${formatAdminNotificationForDisplay(deleteTarget).title}”?`
            : "Delete notification?"
        }
        description="Move this alert to trash? It will be removed from Notifications but kept in Trash where it can be restored."
        confirmLabel="Move to trash"
        busyLabel="Moving…"
        destructive
        confirmPhrase={DELETE_CONFIRM_PHRASE}
        onConfirm={async () => {
          if (deleteTarget) await deleteNotifications([deleteTarget]);
        }}
      />

      <ConfirmDialog
        open={bulkDeleteConfirm}
        onOpenChange={(open) => {
          if (!open) setBulkDeleteConfirm(false);
        }}
        title="Delete selected notifications?"
        description={`Move ${selectedIds.size} notification${selectedIds.size === 1 ? "" : "s"} to trash? They will be removed from Notifications but kept in Trash where they can be restored.`}
        confirmLabel="Move to trash"
        busyLabel="Moving…"
        destructive
        confirmPhrase={DELETE_CONFIRM_PHRASE}
        onConfirm={async () => {
          await deleteNotifications(selectedTargets);
        }}
      />
    </div>
  );
}
