"use client";

import Link from "next/link";
import {
  Activity,
  Calendar,
  Car,
  CheckCircle2,
  CreditCard,
  Headphones,
  MessageSquare,
  Settings,
  Ship,
  ShoppingBag,
  User,
} from "lucide-react";
import { EmptyState } from "@/components/platform/dashboard/empty-state";
import { MobileSectionCollapse } from "@/components/platform/dashboard/mobile-section-collapse";
import { activityIconColors } from "@/lib/platform/design-tokens";
import { PlatformDateTime } from "@/components/platform/platform-datetime";
import { platformPath } from "@/lib/platform/paths";
import type { AdminNotification } from "@/lib/platform/types";
import type { UnifiedLead } from "@/lib/platform/types";
import { leadTypeLabel } from "@/lib/platform/types";
import { cn } from "@/lib/utils";

export type ActivityIconType =
  | "vehicle"
  | "shipment"
  | "customer"
  | "payment"
  | "message"
  | "approval"
  | "support"
  | "appointment";

export type ActivityEvent = {
  id: string;
  type: "notification" | "lead" | "activity";
  title: string;
  subtitle?: string;
  href?: string;
  createdAt: string;
  iconType: ActivityIconType;
  status?: string;
  actor?: string;
};

const ICON_MAP: Record<ActivityIconType, typeof Car> = {
  vehicle: Car,
  shipment: Ship,
  customer: User,
  payment: CreditCard,
  message: MessageSquare,
  approval: CheckCircle2,
  support: Headphones,
  appointment: Calendar,
};

type ActivityTimelineProps = {
  notifications: AdminNotification[];
  recentLeads: UnifiedLead[];
  activityLog?: Array<{
    id: string;
    action: string;
    actor_name: string | null;
    resource: string | null;
    created_at: string;
  }>;
  loading?: boolean;
};

function notificationIconType(type: string): ActivityIconType {
  if (type.includes("vehicle") || type.includes("preorder")) return "vehicle";
  if (type.includes("freight") || type.includes("ship")) return "shipment";
  if (type.includes("payment") || type.includes("finance")) return "payment";
  if (type.includes("appointment")) return "appointment";
  if (type.includes("approval")) return "approval";
  if (type.includes("support")) return "support";
  if (type.includes("team") || type.includes("customer")) return "customer";
  return "message";
}

function activityIconType(action: string): ActivityIconType {
  if (action.includes("vehicle")) return "vehicle";
  if (action.includes("freight") || action.includes("shipment")) return "shipment";
  if (action.includes("payment") || action.includes("finance")) return "payment";
  if (action.includes("appointment")) return "appointment";
  if (action.includes("approval") || action.includes("review")) return "approval";
  if (action.includes("user") || action.includes("invite") || action.includes("customer")) return "customer";
  if (action.includes("support") || action.includes("message")) return "support";
  if (action.includes("sale") || action.includes("lead")) return "vehicle";
  return "message";
}

function formatAction(action: string): string {
  return action.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function isToday(dateStr: string): boolean {
  const d = new Date(dateStr);
  const now = new Date();
  return (
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  );
}

function isYesterday(dateStr: string): boolean {
  const d = new Date(dateStr);
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  return (
    d.getFullYear() === yesterday.getFullYear() &&
    d.getMonth() === yesterday.getMonth() &&
    d.getDate() === yesterday.getDate()
  );
}

type ActivityGroup = "today" | "yesterday" | "earlier";

function groupForDate(dateStr: string): ActivityGroup {
  if (isToday(dateStr)) return "today";
  if (isYesterday(dateStr)) return "yesterday";
  return "earlier";
}

const GROUP_LABELS: Record<ActivityGroup, string> = {
  today: "Today",
  yesterday: "Yesterday",
  earlier: "Earlier",
};

export function buildActivityEvents(
  notifications: AdminNotification[],
  recentLeads: UnifiedLead[],
  activityLog: ActivityTimelineProps["activityLog"] = []
): ActivityEvent[] {
  const fromNotifications: ActivityEvent[] = notifications.slice(0, 5).map((n) => ({
    id: `n-${n.id}`,
    type: "notification",
    title: n.title,
    subtitle: n.message?.slice(0, 80),
    href: n.link ?? platformPath("notifications"),
    createdAt: n.createdAt,
    iconType: notificationIconType(n.type),
    status: n.readAt ? "read" : "new",
    actor: "System",
  }));

  const fromLeads: ActivityEvent[] = recentLeads.slice(0, 4).map((lead) => ({
    id: `l-${lead.type}-${lead.id}`,
    type: "lead",
    title: `New ${leadTypeLabel(lead.type, lead.isCustomRequest)} from ${lead.name}`,
    subtitle: lead.vehicleTitle ?? lead.summary.slice(0, 60),
    href: lead.detailLink ?? `${platformPath("leads")}?tab=${lead.type}`,
    createdAt: lead.createdAt,
    iconType: "appointment",
    status: lead.status,
    actor: lead.name,
  }));

  const fromActivity: ActivityEvent[] = activityLog.slice(0, 6).map((row) => ({
    id: `a-${row.id}`,
    type: "activity",
    title: formatAction(row.action),
    subtitle: row.resource ?? undefined,
    createdAt: row.created_at,
    iconType: activityIconType(row.action),
    actor: row.actor_name ?? "Team member",
  }));

  return [...fromNotifications, ...fromLeads, ...fromActivity]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 14);
}

function StatusPill({ status }: { status?: string }) {
  if (!status) return null;
  const normalized = status.toLowerCase();
  const tone =
    normalized.includes("new") || normalized.includes("pending")
      ? "bg-amber-50 text-amber-600"
      : normalized.includes("sold") || normalized.includes("paid") || normalized.includes("read")
        ? "bg-emerald-50 text-emerald-600"
        : normalized.includes("cancel") || normalized.includes("fail")
          ? "bg-red-50 text-red-600"
          : "bg-blue-50 text-blue-600";

  return (
    <span className={cn("rounded px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide", tone)}>
      {status}
    </span>
  );
}

export function ActivityTimeline({
  notifications,
  recentLeads,
  activityLog = [],
  loading,
}: ActivityTimelineProps) {
  const events = buildActivityEvents(notifications, recentLeads, activityLog);

  const grouped = events.reduce(
    (acc, event) => {
      const g = groupForDate(event.createdAt);
      acc[g].push(event);
      return acc;
    },
    { today: [] as ActivityEvent[], yesterday: [] as ActivityEvent[], earlier: [] as ActivityEvent[] }
  );

  const groups = (["today", "yesterday", "earlier"] as ActivityGroup[]).filter(
    (g) => grouped[g].length > 0
  );

  return (
    <MobileSectionCollapse
      title="Today's activity"
      icon={<Activity className="size-4 shrink-0 text-[var(--platform-accent)]" aria-hidden />}
      className="min-w-0 max-w-full"
    >
      <div className="platform-card min-w-0 max-w-full overflow-hidden rounded-xl">
        {loading ? (
          <div className="space-y-0 divide-y divide-[var(--platform-border)]">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex min-w-0 gap-3 px-3 py-3 sm:px-4">
                <div className="size-9 shrink-0 animate-pulse rounded-lg bg-[var(--platform-bg-secondary)]" />
                <div className="min-w-0 flex-1 space-y-2">
                  <div className="h-3 w-full max-w-[12rem] animate-pulse rounded bg-[var(--platform-bg-secondary)]" />
                  <div className="h-3 w-full max-w-[8rem] animate-pulse rounded bg-[var(--platform-bg-secondary)]" />
                </div>
              </div>
            ))}
          </div>
        ) : events.length === 0 ? (
          <EmptyState
            title="No recent activity"
            description="Notifications, leads, and team actions will appear here as they happen."
            actionLabel="View notifications"
            actionHref={platformPath("notifications")}
          />
        ) : (
          <div className="platform-scrollbar max-h-[min(28rem,60vh)] overflow-y-auto overflow-x-hidden">
            {groups.map((group) => (
              <div key={group} className="min-w-0">
                <p className="sticky top-0 z-[1] border-b border-[var(--platform-border)] bg-[var(--platform-bg-secondary)]/90 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-[var(--platform-text-secondary)] backdrop-blur-sm sm:px-4">
                  {GROUP_LABELS[group]}
                </p>
                <ol className="divide-y divide-[var(--platform-border)]">
                  {grouped[group].map((event) => {
                    const Icon = ICON_MAP[event.iconType];
                    const colors = activityIconColors[event.iconType];

                    const content = (
                      <>
                        <span
                          className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg"
                          style={{ backgroundColor: colors.bg, color: colors.text }}
                        >
                          <Icon className="size-4" aria-hidden />
                        </span>
                        <span className="min-w-0 flex-1 overflow-hidden">
                          <div className="flex min-w-0 flex-wrap items-center gap-2">
                            <p className="min-w-0 break-words text-sm font-medium text-[var(--platform-text)]">
                              {event.title}
                            </p>
                            <StatusPill status={event.status} />
                          </div>
                          {event.subtitle && (
                            <p className="mt-0.5 break-words text-xs text-[var(--platform-text-secondary)]">
                              {event.subtitle}
                            </p>
                          )}
                          <div className="mt-1.5 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-[var(--platform-text-secondary)]">
                            <PlatformDateTime value={event.createdAt} className="text-[11px]" />
                            {event.actor && (
                              <>
                                <span aria-hidden>·</span>
                                <span className="min-w-0 break-words">{event.actor}</span>
                              </>
                            )}
                          </div>
                        </span>
                      </>
                    );

                    return (
                      <li key={event.id} className="min-w-0">
                        {event.href ? (
                          <Link
                            href={event.href}
                            className="flex min-w-0 items-start gap-2.5 px-3 py-3 transition-colors hover:bg-[rgba(139,92,246,0.04)] sm:gap-3 sm:px-4"
                          >
                            {content}
                          </Link>
                        ) : (
                          <div className="flex min-w-0 items-start gap-2.5 px-3 py-3 sm:gap-3 sm:px-4">
                            {content}
                          </div>
                        )}
                      </li>
                    );
                  })}
                </ol>
              </div>
            ))}
          </div>
        )}
      </div>
    </MobileSectionCollapse>
  );
}
