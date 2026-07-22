"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ChevronDown, ChevronLeft, ChevronRight, Star, X } from "lucide-react";
import { Logo } from "@/components/shared/logo";
import {
  PLATFORM_DASHBOARD_ITEM,
  PLATFORM_NAV_DEPARTMENTS,
  ROUTE_TO_DEPARTMENT,
} from "@/lib/platform/nav";
import { navPermissionForHref } from "@/lib/platform/permissions";
import type { PlatformPermission } from "@/lib/platform/permissions";
import { platformPath } from "@/lib/platform/paths";
import { useAdminNotifications } from "@/context/admin-notifications-context";
import { SidebarNavBadge } from "@/components/platform/sidebar-nav-badge";
import { SidebarSearch } from "@/components/platform/sidebar-search";
import { SidebarFavorites } from "@/components/platform/sidebar-favorites";
import { PlatformLogoutAction } from "@/components/platform/platform-logout-action";
import {
  getNavFavorites,
  getRecentNavVisits,
  isNavGroupCollapsed,
  recordNavVisit,
  setNavGroupCollapsed,
  toggleNavFavorite,
} from "@/lib/platform/sidebar-storage";
import { useSwipeToClose, mergeSwipeHandlers } from "@/hooks/use-swipe-to-close";
import { useAfterIdle } from "@/hooks/use-after-idle";
import { cn } from "@/lib/utils";

const TEAM_CHAT_HREF = platformPath("team-chat");
const EMAILS_HREF = platformPath("emails");
const TRASH_HREF = platformPath("trash");
const UNREAD_POLL_MS = 45_000;

type PlatformSidebarProps = {
  collapsed: boolean;
  onToggle: () => void;
  mobileOpen: boolean;
  onMobileClose: () => void;
  onExpand: () => void;
  onMobileRailClose: () => void;
  permissions: Record<PlatformPermission, boolean>;
};

export function PlatformSidebarFooter({ collapsed }: { collapsed: boolean }) {
  return (
    <footer
      aria-label="Account actions"
      data-testid="platform-sidebar-footer"
      className={cn(
        "platform-sidebar-footer relative z-10 shrink-0 border-t border-[var(--platform-border)] bg-[var(--platform-bg-secondary)] p-2",
        !collapsed && "px-3 py-3"
      )}
    >
      <PlatformLogoutAction variant="sidebar" collapsed={collapsed} />
    </footer>
  );
}

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
  const router = useRouter();
  const idleReady = useAfterIdle(2000);
  const departments = useMemo(
    () =>
      PLATFORM_NAV_DEPARTMENTS.map((group) => ({
        ...group,
        items: group.items.filter((item) => permissions[navPermissionForHref(item.href)]),
      })).filter((group) => group.items.length > 0),
    [permissions]
  );

  const navItems = useMemo(
    () => [PLATFORM_DASHBOARD_ITEM, ...departments.flatMap((g) => g.items)],
    [departments]
  );

  const { unreadByNavHref } = useAdminNotifications();
  const [teamUnread, setTeamUnread] = useState(0);
  const [emailFailedCount, setEmailFailedCount] = useState(0);
  const [trashCount, setTrashCount] = useState(0);
  const [isDesktop, setIsDesktop] = useState(false);
  const [favorites, setFavorites] = useState<string[]>([]);
  const [recentVisits, setRecentVisits] = useState(getRecentNavVisits());
  const [collapsedGroups, setCollapsedGroups] = useState<string[]>([]);

  const showMobileDrawer = !isDesktop && mobileOpen;
  const showMobileIconRail = !isDesktop && collapsed && !mobileOpen;

  const activeDepartmentId = useMemo(() => {
    const matches = Object.entries(ROUTE_TO_DEPARTMENT)
      .filter(([href]) => pathname === href || pathname.startsWith(`${href}/`))
      .sort(([a], [b]) => b.length - a.length);
    if (matches[0]) return matches[0][1];
    if (pathname.includes("/dashboard") || pathname === "/platform") return "dashboard";
    return null;
  }, [pathname]);

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
    setFavorites(getNavFavorites());
    setRecentVisits(getRecentNavVisits());
    setCollapsedGroups(
      departments
        .filter((g) => isNavGroupCollapsed(g.id, g.defaultExpanded !== false))
        .map((g) => g.id)
    );
  }, [departments]);

  useEffect(() => {
    const media = window.matchMedia("(min-width: 1024px)");
    const update = () => setIsDesktop(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    // Prefer the most specific nav href so nested routes (e.g. inventory/movements)
    // record that leaf, not the parent list route.
    const match = navItems
      .filter(
        (item) =>
          pathname === item.href ||
          (item.href !== platformPath("dashboard") && pathname.startsWith(`${item.href}/`))
      )
      .sort((a, b) => b.href.length - a.href.length)[0];
    if (match) {
      setRecentVisits(recordNavVisit(match));
    }
  }, [pathname, navItems]);

  useEffect(() => {
    if (!idleReady) return;
    const wantTeam = permissions.team_messages;
    const wantEmail = permissions.emails;
    const wantTrash = permissions.trash;
    if (!wantTeam && !wantEmail && !wantTrash) return;

    async function loadSidebarBadges() {
      try {
        const requests: Promise<Response>[] = [];
        const keys: Array<"team" | "email" | "trash"> = [];
        if (wantTeam) {
          requests.push(fetch("/api/admin/team-messages?summary=1"));
          keys.push("team");
        }
        if (wantEmail) {
          requests.push(fetch("/api/admin/emails?summary=1"));
          keys.push("email");
        }
        if (wantTrash) {
          requests.push(fetch("/api/admin/trash?summary=1"));
          keys.push("trash");
        }
        const results = await Promise.allSettled(requests);
        results.forEach((result, i) => {
          if (result.status !== "fulfilled" || !result.value.ok) return;
          void result.value.json().then((json) => {
            const key = keys[i];
            if (key === "team") setTeamUnread(json.unreadTotal ?? 0);
            if (key === "email") setEmailFailedCount(json.failedCount ?? 0);
            if (key === "trash") setTrashCount(json.count ?? 0);
          });
        });
      } catch {
        // ignore badge refresh failures
      }
    }

    void loadSidebarBadges();
    const timer = setInterval(() => void loadSidebarBadges(), UNREAD_POLL_MS);
    return () => clearInterval(timer);
  }, [
    idleReady,
    permissions.team_messages,
    permissions.emails,
    permissions.trash,
  ]);

  const prefetchRoute = useCallback(
    (href: string) => {
      router.prefetch(href);
    },
    [router]
  );

  const isActive = useCallback(
    (href: string) => {
      if (href.endsWith("/dashboard")) {
        return pathname === href || pathname === href.replace("/dashboard", "") || pathname === "/platform";
      }
      if (pathname === href) return true;
      if (!pathname.startsWith(`${href}/`)) return false;
      // Parent prefix matches (e.g. /inventory) must not win when a more specific
      // nav item matches (e.g. /inventory/movements). Vehicle detail/edit under
      // /inventory/:id still highlight Inventory because no deeper nav leaf exists.
      const hasMoreSpecificNavMatch = navItems.some(
        (item) =>
          item.href !== href &&
          item.href.startsWith(`${href}/`) &&
          (pathname === item.href || pathname.startsWith(`${item.href}/`))
      );
      return !hasMoreSpecificNavMatch;
    },
    [pathname, navItems]
  );

  function badgeCountForHref(href: string): number {
    if (href === TEAM_CHAT_HREF) return Math.max(teamUnread, unreadByNavHref[href] ?? 0);
    if (href === EMAILS_HREF) return emailFailedCount;
    if (href === TRASH_HREF) return trashCount;
    return unreadByNavHref[href] ?? 0;
  }

  function toggleGroup(groupId: string) {
    const collapsedNow = !collapsedGroups.includes(groupId);
    const next = collapsedNow
      ? setNavGroupCollapsed(groupId, true)
      : setNavGroupCollapsed(groupId, false);
    setCollapsedGroups(next);
  }

  function handleFavoriteToggle(e: React.MouseEvent, href: string) {
    e.preventDefault();
    e.stopPropagation();
    setFavorites(toggleNavFavorite(href));
  }

  const dashboardActive = isActive(PLATFORM_DASHBOARD_ITEM.href);
  const DashboardIcon = PLATFORM_DASHBOARD_ITEM.icon;

  return (
    <>
      <button
        type="button"
        aria-label="Close navigation"
        tabIndex={showMobileDrawer ? 0 : -1}
        inert={!showMobileDrawer ? true : undefined}
        className={cn(
          "fixed inset-0 z-40 bg-[#4c1d95]/35 transition-opacity duration-200 supports-backdrop-filter:backdrop-blur-[2px] lg:hidden",
          showMobileDrawer ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0"
        )}
        onClick={onMobileClose}
      />

      <aside
        id="platform-sidebar"
        aria-label="Platform navigation"
        inert={!isDesktop && !mobileOpen && !collapsed ? true : undefined}
        className={cn(
          "flex h-dvh min-h-0 flex-col overflow-hidden border-r border-[var(--platform-border)] bg-[var(--platform-bg-secondary)] transition-[transform,width] duration-300 ease-out",
          "max-lg:fixed max-lg:inset-y-0 max-lg:left-0 max-lg:z-50 max-lg:shadow-xl max-lg:will-change-transform",
          "lg:relative lg:z-auto lg:h-full lg:shrink-0 lg:shadow-none",
          collapsed ? "w-[4.5rem]" : "w-[min(100%-3rem,16rem)] max-lg:w-[min(calc(100vw-3rem),16rem)] sm:w-64",
          showMobileDrawer || showMobileIconRail ? "max-lg:translate-x-0" : "max-lg:-translate-x-full"
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
              <Logo variant="purple" icon height={32} href={false} priority quality={100} className="size-full max-h-8 max-w-8" />
            </Link>
          ) : (
            <>
              <Link href="/platform/dashboard" className="flex min-w-0 flex-1 justify-center" onClick={onMobileClose}>
                <Logo variant="purple" height={62} href={false} priority quality={100} className="max-w-full" />
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

        <SidebarSearch
          items={navItems}
          collapsed={collapsed}
          onNavigate={onMobileClose}
          onExpand={onExpand}
          isActive={isActive}
        />

        <nav className="platform-scrollbar min-h-0 flex-1 overflow-y-auto overscroll-y-contain px-2 pb-2">
          {/* Dashboard — always visible */}
          <ul className="space-y-0.5">
            <li>
              <Link
                href={PLATFORM_DASHBOARD_ITEM.href}
                onClick={onMobileClose}
                onMouseEnter={() => prefetchRoute(PLATFORM_DASHBOARD_ITEM.href)}
                onFocus={() => prefetchRoute(PLATFORM_DASHBOARD_ITEM.href)}
                data-active={dashboardActive}
                className={cn("platform-sidebar-link relative", collapsed && "justify-center px-2")}
                title={collapsed ? PLATFORM_DASHBOARD_ITEM.label : undefined}
              >
                <DashboardIcon className="size-4 shrink-0" />
                {!collapsed && (
                  <span className="min-w-0 flex-1 truncate">{PLATFORM_DASHBOARD_ITEM.label}</span>
                )}
              </Link>
            </li>
          </ul>

          {/* Department groups */}
          {departments.map((group, groupIndex) => {
            const groupCollapsed = collapsedGroups.includes(group.id);
            const groupActive = activeDepartmentId === group.id;
            const GroupIcon = group.icon;

            return (
              <div key={group.id} className={groupIndex >= 0 ? "mt-3" : ""}>
                {!collapsed ? (
                  <button
                    type="button"
                    onClick={() => toggleGroup(group.id)}
                    aria-expanded={!groupCollapsed}
                    className={cn(
                      "flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-[10px] font-semibold uppercase tracking-[0.12em] transition-colors",
                      groupActive
                        ? "text-[var(--platform-text)]"
                        : "text-[var(--platform-text-secondary)] hover:text-[var(--platform-text)]"
                    )}
                  >
                    <GroupIcon className="size-3.5 shrink-0" aria-hidden />
                    <span className="min-w-0 flex-1 truncate">{group.label}</span>
                    {groupCollapsed ? (
                      <ChevronRight className="size-3.5 shrink-0" aria-hidden />
                    ) : (
                      <ChevronDown className="size-3.5 shrink-0" aria-hidden />
                    )}
                  </button>
                ) : null}

                {(!groupCollapsed || collapsed) && (
                  <ul className={cn("space-y-0.5", !collapsed && !groupCollapsed && "mt-0.5")} role="group" aria-label={group.label}>
                    {group.items.map((item) => {
                      const active = isActive(item.href);
                      const Icon = item.icon;
                      const badgeCount = badgeCountForHref(item.href);
                      const isFavorite = favorites.includes(item.href);

                      return (
                        <li key={item.href}>
                          <Link
                            href={item.href}
                            onClick={onMobileClose}
                            onMouseEnter={() => prefetchRoute(item.href)}
                            onFocus={() => prefetchRoute(item.href)}
                            data-active={active}
                            className={cn(
                              "platform-sidebar-link relative group/item",
                              collapsed && "justify-center px-2",
                              groupActive && !active && !collapsed && "opacity-90"
                            )}
                            title={
                              collapsed
                                ? `${item.label}${badgeCount ? ` (${badgeCount} unread)` : ""}`
                                : undefined
                            }
                            aria-label={badgeCount > 0 ? `${item.label}, ${badgeCount} unread` : item.label}
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
                            {!collapsed && (
                              <button
                                type="button"
                                onClick={(e) => handleFavoriteToggle(e, item.href)}
                                className={cn(
                                  "ml-1 shrink-0 rounded p-0.5 opacity-0 transition-opacity group-hover/item:opacity-100 focus:opacity-100",
                                  isFavorite && "opacity-100 text-[var(--platform-accent)]"
                                )}
                                aria-label={isFavorite ? "Remove from favorites" : "Add to favorites"}
                                aria-pressed={isFavorite}
                              >
                                <Star className={cn("size-3.5", isFavorite && "fill-current")} />
                              </button>
                            )}
                            {collapsed && <SidebarNavBadge count={badgeCount} collapsed />}
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            );
          })}

          <SidebarFavorites
            favoriteHrefs={favorites}
            recentVisits={recentVisits}
            navItems={navItems}
            collapsed={collapsed}
            onNavigate={onMobileClose}
            isActive={isActive}
          />
        </nav>
        <PlatformSidebarFooter collapsed={collapsed} />
      </aside>
    </>
  );
}
