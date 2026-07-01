"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  AlertTriangle,
  Bell,
  Car,
  CreditCard,
  MessageSquare,
  MessagesSquare,
  Package,
  ShoppingBag,
  Ship,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { platformPath } from "@/lib/platform/paths";
import { PreorderNotificationPreview } from "@/components/platform/preorder-notification-preview";
import { useAdminNotifications } from "@/context/admin-notifications-context";
import type { AdminNotification } from "@/lib/platform/types";
import { PlatformDateTime } from "@/components/platform/platform-datetime";

const TYPE_ICONS: Record<string, typeof Bell> = {
  preorder: ShoppingBag,
  vehicle: Car,
  contact: MessageSquare,
  finance: CreditCard,
  appraisal: Package,
  low_stock: AlertTriangle,
  team_message: MessagesSquare,
  customer_message: MessageSquare,
  support_ticket_reopened: MessageSquare,
  support_ticket_claimed: MessageSquare,
  vehicle_pending_approval: Car,
  freight_quote: Ship,
};

type NotificationCenterProps = {
  className?: string;
};

export function NotificationCenter({ className }: NotificationCenterProps) {
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const pathname = usePathname() ?? "";
  const { notifications, unreadCount, load, markRead, markReadMatching, markAllRead } =
    useAdminNotifications();

  useEffect(() => {
    if (!open) return;
    function onClickOutside(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [open]);

  function handleOpen() {
    const willOpen = !open;
    setOpen(willOpen);
    if (willOpen) {
      void load();
      void markReadMatching({ link: pathname });
    }
  }

  return (
    <div ref={panelRef} className={cn("relative", className)}>
      <button
        type="button"
        onClick={handleOpen}
        className="platform-btn-ghost relative size-9"
        aria-label={`Notifications${unreadCount ? `, ${unreadCount} unread` : ""}`}
      >
        <Bell className="size-4" />
        {unreadCount > 0 && (
          <span className="absolute right-1 top-1 flex size-4 items-center justify-center rounded-full bg-[var(--platform-error)] text-[10px] font-bold text-white">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <>
          <button
            type="button"
            aria-label="Close notifications"
            className="fixed inset-0 z-40 bg-[#4c1d95]/20 supports-backdrop-filter:backdrop-blur-[1px] lg:hidden"
            onClick={() => setOpen(false)}
          />
          <div
            className={cn(
              "z-50 overflow-hidden rounded-xl border border-[var(--platform-border)] bg-[var(--platform-card)] shadow-xl",
              "fixed inset-x-3 top-[3.75rem] max-h-[min(28rem,calc(100dvh-5rem))] w-auto",
              "lg:absolute lg:inset-x-auto lg:right-0 lg:top-full lg:mt-1 lg:max-h-none lg:w-[min(100vw-2rem,22rem)]"
            )}
          >
            <div className="flex items-center justify-between gap-3 border-b border-[var(--platform-border)] px-4 py-3">
              <p className="text-sm font-semibold text-[var(--platform-text)]">Notifications</p>
              {unreadCount > 0 && (
                <button
                  type="button"
                  onClick={markAllRead}
                  className="shrink-0 rounded-md px-2 py-1.5 text-xs font-medium text-[var(--platform-accent)] hover:bg-[rgba(139,92,246,0.08)]"
                >
                  Mark all read
                </button>
              )}
            </div>

            <div className="max-h-[min(22rem,calc(100dvh-10rem))] overflow-y-auto overscroll-contain lg:max-h-80">
              {notifications.length === 0 ? (
                <p className="px-4 py-8 text-center text-sm text-[var(--platform-text-secondary)]">
                  No notifications yet.
                </p>
              ) : (
                notifications.map((n) => (
                  <NotificationRow
                    key={n.id}
                    notification={n}
                    onOpen={() => {
                      if (!n.readAt && n.id !== "low-stock") void markRead(n.id);
                    }}
                    onNavigate={() => {
                      setOpen(false);
                    }}
                  />
                ))
              )}
            </div>

            <div className="border-t border-[var(--platform-border)] px-4 py-3">
              <Link
                href={platformPath("notifications")}
                onClick={() => setOpen(false)}
                className="flex min-h-10 items-center justify-center rounded-lg bg-[rgba(139,92,246,0.08)] text-sm font-medium text-[var(--platform-accent)] transition-colors hover:bg-[rgba(139,92,246,0.12)]"
              >
                View all notifications
              </Link>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function NotificationRow({
  notification: n,
  onOpen,
  onNavigate,
}: {
  notification: AdminNotification;
  onOpen: () => void;
  onNavigate: () => void;
}) {
  const Icon = TYPE_ICONS[n.type] ?? Bell;
  const unread = !n.readAt;
  const href = n.link ?? platformPath("leads");

  return (
    <Link
      href={href}
      onClick={() => {
        onOpen();
        onNavigate();
      }}
      className={cn(
        "flex items-start gap-3 border-b border-[var(--platform-border)] px-4 py-3.5 transition-colors last:border-0 hover:bg-[rgba(76,29,149,0.04)] active:bg-[rgba(76,29,149,0.06)]",
        unread && "bg-[rgba(139,92,246,0.06)]"
      )}
    >
      <span
        className={cn(
          "mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg",
          unread
            ? "bg-[rgba(139,92,246,0.15)] text-[var(--platform-accent)]"
            : "bg-[var(--platform-bg)] text-[var(--platform-text-secondary)]"
        )}
      >
        <Icon className="size-4" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-start gap-2">
          <p className="min-w-0 flex-1 text-sm font-medium leading-snug text-[var(--platform-text)]">
            {n.title}
          </p>
          {unread && (
            <span className="mt-1.5 size-2 shrink-0 rounded-full bg-[var(--platform-accent)]" />
          )}
        </div>
        <PreorderNotificationPreview notification={n} variant="compact" />
        <p className="mt-1.5 text-[11px] text-[var(--platform-text-secondary)]">
          <PlatformDateTime value={n.createdAt} className="text-[11px]" />
        </p>
      </div>
    </Link>
  );
}
