"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { ChevronLeft, X } from "lucide-react";
import { Logo } from "@/components/shared/logo";
import { PLATFORM_NAV_GROUPS } from "@/lib/platform/nav";
import { navPermissionForHref } from "@/lib/platform/permissions";
import type { PlatformPermission } from "@/lib/platform/permissions";
import { platformPath } from "@/lib/platform/paths";
import { useAdminNotifications } from "@/context/admin-notifications-context";
import { SidebarNavBadge } from "@/components/platform/sidebar-nav-badge";
import { useSwipeToClose, mergeSwipeHandlers } from "@/hooks/use-swipe-to-close";
import { cn } from "@/lib/utils";

const TEAM_CHAT_HREF = platformPath("team-chat");
const EMAILS_HREF = platformPath("emails");
const TRASH_HREF = platformPath("trash");
const UNREAD_POLL_MS = 30_000;

type PlatformSidebarProps = {
  collapsed: boolean;
  onToggle: () => void;
  mobileOpen: boolean;
  onMobileClose: () => void;
  onExpand: () => void;
  onMobileRailClose: () => void;
  permissions: Record<PlatformPermission, boolean>;
};

export function PlatformSidebar({
  collapsed,
  onToggle,
  mobileOpen,
  onMobileClose,
  onExpand,
  onMobileRailClose,
  permissions,
}: PlatformSidebarProps) {
  const pathname = usePathname() ?? "";
  const navGroups = PLATFORM_NAV_GROUPS.map((group) => ({
    ...group,
    items: group.items.filter((item) => permissions[navPermissionForHref(item.href)]),
  })).filter((group) => group.items.length > 0);
  const navItems = navGroups.flatMap((group) => group.items);
  const { unreadByNavHref } = useAdminNotifications();
  const [teamUnread, setTeamUnread] = useState(0);
  const [emailFailedCount, setEmailFailedCount] = useState(0);
  const [trashCount, setTrashCount] = useState(0);
  const [isDesktop, setIsDesktop] = useState(false);
  const showMobileDrawer = !isDesktop && mobileOpen;
  const showMobileIconRail = !isDesktop && collapsed && !mobileOpen;
  const swipeToCloseHandlers = useSwipeToClose({
    enabled: showMobileDrawer,
    onClose: onMobileClose,
    direction: "left",
  });
  const swipeToExpandHandlers = useSwipeToClose({
    enabled: showMobileIconRail,
    onClose: onExpand,
    direction: "right",
  });
  const swipeRailCloseHandlers = useSwipeToClose({
    enabled: showMobileIconRail,
    onClose: onMobileRailClose,
    direction: "left",
  });
  const swipeHandlers = mergeSwipeHandlers(
    swipeToCloseHandlers,
    swipeToExpandHandlers,
    swipeRailCloseHandlers
  );

  useEffect(() => {
    const media = window.matchMedia("(min-width: 1024px)");
    const update = () => setIsDesktop(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    if (!permissions.team_messages) return;

    async function loadUnread() {
      try {
        const res = await fetch("/api/admin/team-messages");
        if (!res.ok) return;
        const json = await res.json();
        setTeamUnread(json.unreadTotal ?? 0);
      } catch {
        // ignore
      }
    }

    void loadUnread();
    const timer = setInterval(() => void loadUnread(), UNREAD_POLL_MS);
    return () => clearInterval(timer);
  }, [permissions.team_messages]);

  useEffect(() => {
    if (!permissions.emails) return;

    async function loadEmailFailures() {
      try {
        const res = await fetch("/api/admin/emails?summary=1");
        if (!res.ok) return;
        const json = await res.json();
        setEmailFailedCount(json.failedCount ?? 0);
      } catch {
        // ignore
      }
    }

    void loadEmailFailures();
    const timer = setInterval(() => void loadEmailFailures(), UNREAD_POLL_MS);
    return () => clearInterval(timer);
  }, [permissions.emails]);

  useEffect(() => {
    if (!permissions.trash) return;

    async function loadTrashCount() {
      try {
        const res = await fetch("/api/admin/trash?summary=1");
        if (!res.ok) return;
        const json = await res.json();
        setTrashCount(json.count ?? 0);
      } catch {
        // ignore
      }
    }

    void loadTrashCount();
    const timer = setInterval(() => void loadTrashCount(), UNREAD_POLL_MS);
    return () => clearInterval(timer);
  }, [permissions.trash]);

  function isActive(href: string) {
    if (href.endsWith("/dashboard")) {
      return pathname === href || pathname === href.replace("/dashboard", "");
    }
    return pathname === href || pathname.startsWith(`${href}/`);
  }

  function badgeCountForHref(href: string): number {
    if (href === TEAM_CHAT_HREF) {
      return Math.max(teamUnread, unreadByNavHref[href] ?? 0);
    }
    if (href === EMAILS_HREF) {
      return emailFailedCount;
    }
    if (href === TRASH_HREF) {
      return trashCount;
    }
    return unreadByNavHref[href] ?? 0;
  }

  const recentUnread = Object.entries(unreadByNavHref)
    .filter(([href, count]) => count > 0 && navItems.some((item) => item.href === href))
    .sort(([, a], [, b]) => b - a)
    .slice(0, 3);

  return (
    <>
      <button
        type="button"
        aria-label="Close navigation"
        aria-hidden={!showMobileDrawer}
        tabIndex={showMobileDrawer ? 0 : -1}
        className={cn(
          "fixed inset-0 z-40 bg-[#4c1d95]/35 transition-opacity duration-200 supports-backdrop-filter:backdrop-blur-[2px] lg:hidden",
          showMobileDrawer
            ? "pointer-events-auto opacity-100"
            : "pointer-events-none opacity-0"
        )}
        onClick={onMobileClose}
      />

      <aside
        id="platform-sidebar"
        aria-label="Platform navigation"
        aria-hidden={isDesktop ? false : !mobileOpen && !collapsed}
        className={cn(
          "flex h-dvh min-h-0 flex-col overflow-hidden border-r border-[var(--platform-border)] bg-[var(--platform-bg-secondary)] transition-[transform,width] duration-300 ease-out",
          "max-lg:fixed max-lg:inset-y-0 max-lg:left-0 max-lg:z-50 max-lg:shadow-xl max-lg:will-change-transform",
          "lg:relative lg:z-auto lg:h-full lg:shrink-0 lg:shadow-none",
          collapsed ? "w-[4.5rem]" : "w-[min(100vw-3rem,16rem)] sm:w-64",
          showMobileDrawer || showMobileIconRail
            ? "max-lg:translate-x-0"
            : "max-lg:-translate-x-full"
        )}
        {...swipeHandlers}
      >
        <div
          className={cn(
            "shrink-0 border-b border-[var(--platform-border)]",
            collapsed
              ? "flex items-center justify-center px-1.5 py-3"
              : "flex items-center justify-between gap-2 px-3 py-4 sm:px-4 sm:py-5"
          )}
        >
          {collapsed ? (
            <Link
              href="/platform/dashboard"
              className="flex size-8 max-w-full items-center justify-center"
              onClick={onMobileClose}
              title="True Goshen Admin"
            >
              <Logo
                variant="purple"
                icon
                height={32}
                href={false}
                priority
                quality={100}
                className="size-full max-h-8 max-w-8"
              />
            </Link>
          ) : (
            <>
              <Link
                href="/platform/dashboard"
                className="flex min-w-0 flex-1 justify-center"
                onClick={onMobileClose}
              >
                <Logo
                  variant="purple"
                  height={62}
                  href={false}
                  priority
                  quality={100}
                  className="max-w-full"
                />
              </Link>
              <button
                type="button"
                onClick={onMobileClose}
                className="platform-btn-ghost size-10 shrink-0 text-[var(--platform-text)] max-lg:inline-flex lg:hidden"
                aria-label="Close navigation"
              >
                <X className="size-5" strokeWidth={2.25} />
              </button>
              <button
                type="button"
                onClick={onToggle}
                className="platform-btn-ghost size-10 shrink-0 text-[var(--platform-text)] max-lg:hidden lg:inline-flex"
                aria-label="Collapse sidebar"
              >
                <ChevronLeft className="size-5" strokeWidth={2.25} />
              </button>
            </>
          )}
        </div>

        <nav className="platform-scrollbar min-h-0 flex-1 overflow-y-auto overscroll-y-contain px-2 pb-2 pt-3">
          {navGroups.map((group, groupIndex) => (
            <div key={group.label ?? `group-${groupIndex}`} className={groupIndex > 0 ? "mt-4" : ""}>
              {!collapsed && group.label && (
                <p className="px-2 pb-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--platform-text-secondary)]">
                  {group.label}
                </p>
              )}
              <ul className="space-y-0.5">
                {group.items.map((item) => {
                  const active = isActive(item.href);
                  const Icon = item.icon;
                  const badgeCount = badgeCountForHref(item.href);
                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        onClick={onMobileClose}
                        data-active={active}
                        className={cn(
                          "platform-sidebar-link relative",
                          collapsed && "justify-center px-2"
                        )}
                        title={
                          collapsed
                            ? `${item.label}${badgeCount ? ` (${badgeCount} unread)` : ""} — ${item.description ?? ""}`
                            : undefined
                        }
                        aria-label={
                          badgeCount > 0 ? `${item.label}, ${badgeCount} unread` : item.label
                        }
                      >
                        <Icon className="size-4 shrink-0" />
                        {!collapsed && (
                          <span className="min-w-0 flex-1">
                            <span className="flex items-center gap-2 truncate">
                              <span className="truncate">{item.label}</span>
                              <SidebarNavBadge count={badgeCount} />
                            </span>
                            {item.description && (
                              <span className="block truncate text-[10px] font-normal leading-tight text-[var(--platform-text-secondary)] opacity-80">
                                {item.description}
                              </span>
                            )}
                          </span>
                        )}
                        {collapsed && <SidebarNavBadge count={badgeCount} collapsed />}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}

          {!collapsed && recentUnread.length > 0 && (
            <div className="mt-4 border-t border-[var(--platform-border)] pt-3">
              <p className="px-2 pb-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--platform-text-secondary)]">
                Unread alerts
              </p>
              <ul className="space-y-0.5">
                {recentUnread.map(([href, count]) => {
                  const item = navItems.find((nav) => nav.href === href);
                  if (!item) return null;
                  return (
                    <li key={href}>
                      <Link
                        href={href}
                        onClick={onMobileClose}
                        className="flex items-center justify-between gap-2 rounded-md px-2 py-1.5 text-xs text-[var(--platform-text-secondary)] transition-colors hover:bg-[rgba(139,92,246,0.08)] hover:text-[var(--platform-text)]"
                      >
                        <span className="truncate">{item.label}</span>
                        <SidebarNavBadge count={count} />
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </nav>
      </aside>
    </>
  );
}
