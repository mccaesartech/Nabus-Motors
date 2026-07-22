"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  formatAdminNotificationForDisplay,
  type NotificationDisplay,
} from "@/lib/platform/notification-display";
import type { AdminNotification } from "@/lib/platform/types";

type AdminNotificationBodyProps = {
  notification: AdminNotification;
  variant?: "compact" | "full";
  className?: string;
};

const SEVERITY_STYLES = {
  urgent: "bg-[rgba(220,38,38,0.12)] text-[var(--platform-error)]",
  warning: "bg-[rgba(245,158,11,0.12)] text-[var(--platform-warning)]",
  info: "bg-[rgba(139,92,246,0.12)] text-[var(--platform-accent)]",
} as const;

function SeverityBadge({ display }: { display: NotificationDisplay }) {
  return (
    <span
      className={cn(
        "rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
        SEVERITY_STYLES[display.severity]
      )}
    >
      {display.severityLabel}
    </span>
  );
}

export function AdminNotificationBody({
  notification,
  variant = "full",
  className,
}: AdminNotificationBodyProps) {
  const [showTechnical, setShowTechnical] = useState(false);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const display = formatAdminNotificationForDisplay(notification);
  const metadata = notification.metadata as Record<string, unknown> | undefined;
  const pendingMessage =
    display.pendingMessage ??
    (typeof metadata?.pendingMessage === "string" ? metadata.pendingMessage : undefined);
  const setupLink =
    display.setupLink ??
    (metadata?.setupLink as { href: string; label: string } | undefined);
  const technicalDetail =
    display.technicalDetail ??
    (typeof metadata?.technicalDetail === "string" ? metadata.technicalDetail : undefined);

  useEffect(() => {
    void fetch("/api/admin/session")
      .then((res) => (res.ok ? res.json() : null))
      .then((json) => {
        setIsSuperAdmin(json?.user?.role === "super_admin");
      });
  }, []);

  if (variant === "compact") {
    return (
      <p className={cn("mt-1 line-clamp-2 text-xs leading-relaxed text-[var(--platform-text-secondary)]", className)}>
        {display.message}
      </p>
    );
  }

  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex flex-wrap items-center gap-2">
        <SeverityBadge display={display} />
      </div>

      <p className="text-sm leading-relaxed text-[var(--platform-text-secondary)]">
        {display.message}
      </p>

      {setupLink && (
        <Link
          href={setupLink.href}
          className="inline-flex text-sm font-medium text-[var(--platform-accent)] hover:underline"
        >
          {setupLink.label} →
        </Link>
      )}

      {pendingMessage && (
        <div className="rounded-lg border border-[var(--platform-border)] bg-[var(--platform-bg)] px-3 py-2.5">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--platform-text-secondary)]">
            Message that would be sent
          </p>
          <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-[var(--platform-text)]">
            {pendingMessage}
          </p>
        </div>
      )}

      {isSuperAdmin && technicalDetail && (
        <div className="rounded-lg border border-[var(--platform-border)]">
          <button
            type="button"
            onClick={() => setShowTechnical((open) => !open)}
            className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-xs font-medium text-[var(--platform-text-secondary)] hover:bg-[var(--platform-bg)]"
          >
            Technical details
            <ChevronDown
              className={cn("size-4 shrink-0 transition-transform", showTechnical && "rotate-180")}
            />
          </button>
          {showTechnical && (
            <pre className="max-h-40 overflow-x-auto overflow-y-auto border-t border-[var(--platform-border)] px-3 py-2 text-[11px] leading-relaxed break-all whitespace-pre-wrap text-[var(--platform-text-secondary)]">
              {technicalDetail}
            </pre>
          )}
        </div>
      )}
    </div>
  );
}

export function adminNotificationHref(notification: AdminNotification): string {
  const display = formatAdminNotificationForDisplay(notification);
  return display.link ?? notification.link ?? "/platform/leads";
}

export function adminNotificationLinkLabel(notification: AdminNotification): string {
  const display = formatAdminNotificationForDisplay(notification);
  return display.linkLabel;
}
