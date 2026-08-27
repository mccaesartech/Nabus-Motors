"use client";

import Link from "next/link";
import { Bell, CheckCheck } from "lucide-react";
import { AccountSectionHeader } from "@/components/account/account-section-header";
import { Button } from "@/components/ui/button";
import { useCustomerNotifications } from "@/context/customer-notifications-context";
import { sanitizeCustomerNotificationTitle } from "@/lib/customer/public-branding";
import { cn } from "@/lib/utils";

function formatWhen(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function AccountNotificationsSection() {
  const { notifications, unreadCount, loading, markRead, markAllRead } =
    useCustomerNotifications();

  if (loading && notifications.length === 0) {
    return (
      <section
        id="notifications"
        className="scroll-mt-[calc(var(--header-height)+1rem)] space-y-4"
      >
        <AccountSectionHeader
          icon={<Bell className="size-5" />}
          title="Notifications"
          description="Loading updates…"
        />
      </section>
    );
  }

  if (notifications.length === 0) {
    return null;
  }

  return (
    <section
      id="notifications"
      className="scroll-mt-[calc(var(--header-height)+1rem)] space-y-4"
    >
      <AccountSectionHeader
        icon={<Bell className="size-5" />}
        title="Notifications"
        description={
          unreadCount > 0
            ? `${unreadCount} unread update${unreadCount === 1 ? "" : "s"}`
            : "You're all caught up"
        }
        action={
          unreadCount > 0 ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={() => void markAllRead()}
            >
              <CheckCheck className="size-3.5" />
              Mark all read
            </Button>
          ) : undefined
        }
      />

      <ul className="space-y-2">
        {notifications.map((notification) => {
          const unread = !notification.readAt;
          const content = (
            <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
              <div className="min-w-0">
                <p
                  className={cn(
                    "text-sm",
                    unread ? "font-semibold text-foreground" : "font-medium text-foreground/90"
                  )}
                >
                  {sanitizeCustomerNotificationTitle(notification.title)}
                </p>
                <p className="mt-0.5 text-sm text-muted-foreground">{notification.body}</p>
              </div>
              <time
                className="shrink-0 text-xs text-muted-foreground"
                dateTime={notification.createdAt}
              >
                {formatWhen(notification.createdAt)}
              </time>
            </div>
          );

          const className = cn(
            "block rounded-xl border px-4 py-3 transition-colors",
            unread
              ? "border-brand-purple/30 bg-brand-purple/5 shadow-sm"
              : "border-border bg-card hover:bg-muted/40"
          );

          if (notification.link) {
            return (
              <li key={notification.id}>
                <Link
                  href={notification.link}
                  className={className}
                  onClick={() => {
                    if (unread) void markRead(notification.id);
                  }}
                >
                  {content}
                </Link>
              </li>
            );
          }

          return (
            <li key={notification.id}>
              <button
                type="button"
                className={cn(className, "w-full text-left")}
                onClick={() => {
                  if (unread) void markRead(notification.id);
                }}
              >
                {content}
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
