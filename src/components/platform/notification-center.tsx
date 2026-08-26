"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import { createPortal } from "react-dom";
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
import { PreorderNotificationPreview, CartOrderNotificationPreview } from "@/components/platform/preorder-notification-preview";
import {
  AdminNotificationBody,
  adminNotificationHref,
} from "@/components/platform/admin-notification-body";
import { useAdminNotifications } from "@/context/admin-notifications-context";
import { formatAdminNotificationForDisplay } from "@/lib/platform/notification-display";
import type { AdminNotification } from "@/lib/platform/types";
import { PlatformDateTime } from "@/components/platform/platform-datetime";

/** Highest overlay layer in the admin UI (above gallery z-200, account menu z-100, sidebar z-50). */
const NOTIFICATION_Z_INDEX = 9999;

const TYPE_ICONS: Record<string, typeof Bell> = {
  preorder: ShoppingBag,
  order: ShoppingBag,
  vehicle_order: Car,
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
  vehicle_stock_action: Package,
  freight_quote: Ship,
  delivery_deferred: AlertTriangle,
  delivery_failed: AlertTriangle,
};

export type NotificationCategory = "urgent" | "warning" | "info" | "completed";

const URGENT_TYPES = new Set([
  "low_stock",
  "vehicle_pending_approval",
  "vehicle_stock_action",
  "support_ticket_reopened",
]);

const WARNING_TYPES = new Set([
  "preorder",
  "order",
  "vehicle_order",
  "finance",
  "freight_quote",
  "appraisal",
  "delivery_failed",
  "delivery_deferred",
]);

function categorizeNotification(n: AdminNotification): NotificationCategory {
  if (n.readAt) return "completed";
  if (URGENT_TYPES.has(n.type)) return "urgent";
  if (WARNING_TYPES.has(n.type)) return "warning";
  return "info";
}

const CATEGORY_LABELS: Record<NotificationCategory, string> = {
  urgent: "Urgent",
  warning: "Warnings",
  info: "Information",
  completed: "Completed",
};

const CATEGORY_ORDER: NotificationCategory[] = ["urgent", "warning", "info", "completed"];

const FALLBACK_PANEL_STYLE: CSSProperties = {
  position: "fixed",
  top: "3.5rem",
  right: "0.75rem",
  left: "auto",
  width: "min(22rem, calc(100vw - 1.5rem))",
  zIndex: NOTIFICATION_Z_INDEX,
};

type NotificationCenterProps = {
  className?: string;
};

function computePanelStyle(trigger: HTMLElement | null): CSSProperties {
  if (!trigger || typeof window === "undefined") {
    return FALLBACK_PANEL_STYLE;
  }

  const rect = trigger.getBoundingClientRect();
  const isDesktop = window.matchMedia("(min-width: 1024px)").matches;
  const gap = 4;
  const width = Math.min(window.innerWidth - 16, 22 * 16);

  if (isDesktop) {
    return {
      position: "fixed",
      top: rect.bottom + gap,
      left: Math.max(8, Math.min(rect.right - width, window.innerWidth - width - 8)),
      right: "auto",
      width,
      zIndex: NOTIFICATION_Z_INDEX,
    };
  }

  return {
    position: "fixed",
    top: "3.75rem",
    left: "0.75rem",
    right: "0.75rem",
    width: "auto",
    zIndex: NOTIFICATION_Z_INDEX,
  };
}

export function NotificationCenter({ className }: NotificationCenterProps) {
  const [open, setOpen] = useState(false);
  const [panelStyle, setPanelStyle] = useState<CSSProperties>(FALLBACK_PANEL_STYLE);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const pathname = usePathname() ?? "";
  const { notifications, unreadCount, load, markRead, markReadMatching, markAllRead } =
    useAdminNotifications();

  const updatePosition = useCallback(() => {
    setPanelStyle(computePanelStyle(triggerRef.current));
  }, []);

  useLayoutEffect(() => {
    if (!open) return;
    updatePosition();
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [open, updatePosition]);

  // Defer outside-click so the opening click cannot immediately dismiss the panel.
  useEffect(() => {
    if (!open) return;

    function onPointerDown(e: PointerEvent) {
      const target = e.target as Node;
      if (
        panelRef.current?.contains(target) ||
        triggerRef.current?.contains(target)
      ) {
        return;
      }
      setOpen(false);
    }

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }

    const timer = window.setTimeout(() => {
      document.addEventListener("pointerdown", onPointerDown);
      document.addEventListener("keydown", onKeyDown);
    }, 0);

    return () => {
      window.clearTimeout(timer);
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  function handleToggle() {
    const willOpen = !open;
    if (willOpen) {
      setPanelStyle(computePanelStyle(triggerRef.current));
      setOpen(true);
      void load();
      void markReadMatching({ link: pathname });
      return;
    }
    setOpen(false);
  }

  const panel =
    open && typeof document !== "undefined"
      ? createPortal(
          <>
            <button
              type="button"
              aria-label="Close notifications"
              className="fixed inset-0 bg-[#4c1d95]/25 supports-backdrop-filter:backdrop-blur-[1px] lg:bg-transparent lg:backdrop-blur-none"
              style={{ zIndex: NOTIFICATION_Z_INDEX - 1 }}
              onClick={() => setOpen(false)}
            />
            <div
              ref={panelRef}
              role="dialog"
              aria-label="Notifications"
              style={panelStyle}
              className={cn(
                "platform-notification-panel overflow-hidden rounded-xl",
                "max-h-[min(28rem,calc(100dvh-5rem))]"
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
                  CATEGORY_ORDER.map((category) => {
                    const items = notifications.filter(
                      (n) => categorizeNotification(n) === category
                    );
                    if (items.length === 0) return null;
                    return (
                      <div key={category}>
                        <p className="sticky top-0 z-[1] border-b border-[var(--platform-border)] bg-[var(--platform-bg-secondary)] px-4 py-2 text-[10px] font-semibold uppercase tracking-[0.1em] text-[var(--platform-text-secondary)]">
                          {CATEGORY_LABELS[category]}
                        </p>
                        {items.map((n) => (
                          <NotificationRow
                            key={n.id}
                            notification={n}
                            category={category}
                            onOpen={() => {
                              if (!n.readAt && n.id !== "low-stock") void markRead(n.id);
                            }}
                            onNavigate={() => {
                              setOpen(false);
                            }}
                          />
                        ))}
                      </div>
                    );
                  })
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
          </>,
          document.body
        )
      : null;

  return (
    <div className={cn("relative", className)}>
      <button
        ref={triggerRef}
        type="button"
        onClick={handleToggle}
        className="platform-btn-ghost relative size-9"
        aria-label={`Notifications${unreadCount ? `, ${unreadCount} unread` : ""}`}
        aria-expanded={open}
        aria-haspopup="dialog"
      >
        <Bell className="size-4" />
        {unreadCount > 0 && (
          <span className="pointer-events-none absolute -right-0.5 -top-0.5 flex h-3.5 min-w-3.5 items-center justify-center rounded-full bg-[var(--platform-error)] px-0.5 text-[9px] font-bold leading-none text-white ring-1 ring-[var(--platform-bg)]">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>
      {panel}
    </div>
  );
}

function NotificationRow({
  notification: n,
  category,
  onOpen,
  onNavigate,
}: {
  notification: AdminNotification;
  category: NotificationCategory;
  onOpen: () => void;
  onNavigate: () => void;
}) {
  const Icon = TYPE_ICONS[n.type] ?? Bell;
  const unread = !n.readAt;
  const display = formatAdminNotificationForDisplay(n);
  const href = adminNotificationHref(n);
  const isDelivery = n.type === "delivery_failed" || n.type === "delivery_deferred";
  const isOrderAlert = n.type === "order" || n.type === "vehicle_order";
  const isPreorderAlert = n.type === "preorder";

  return (
    <Link
      href={href}
      onClick={() => {
        onOpen();
        onNavigate();
      }}
      className={cn(
        "flex items-start gap-3 border-b border-[var(--platform-border)] px-4 py-3.5 transition-colors last:border-0 hover:bg-[rgba(76,29,149,0.04)] active:bg-[rgba(76,29,149,0.06)]",
        unread &&
          category !== "urgent" &&
          category !== "warning" &&
          "bg-[rgba(139,92,246,0.06)]",
        category === "urgent" && unread && "platform-card-accent-urgent",
        category === "warning" && unread && "platform-card-accent-warning"
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
            {display.title}
          </p>
          {unread && (
            <span className="mt-1.5 size-2 shrink-0 rounded-full bg-[var(--platform-accent)]" />
          )}
        </div>
        {isPreorderAlert ? <PreorderNotificationPreview notification={n} variant="compact" /> : null}
        {isOrderAlert ? <CartOrderNotificationPreview notification={n} variant="compact" /> : null}
        {isDelivery ? (
          <AdminNotificationBody notification={n} variant="compact" />
        ) : isOrderAlert || isPreorderAlert ? null : (
          <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-[var(--platform-text-secondary)]">
            {display.message}
          </p>
        )}
        <p className="mt-1.5 text-[11px] text-[var(--platform-text-secondary)]">
          <PlatformDateTime value={n.createdAt} className="text-[11px]" />
        </p>
      </div>
    </Link>
  );
}
