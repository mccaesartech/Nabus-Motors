"use client";

import Link from "next/link";
import { ChevronDown, ChevronRight, Clock, Star } from "lucide-react";
import type { PlatformNavItem } from "@/lib/platform/nav";
import { navItemMatchesSearch } from "@/lib/platform/nav-search";
import type { RecentNavVisit } from "@/lib/platform/sidebar-storage";
import { cn } from "@/lib/utils";

type SidebarFavoritesProps = {
  favoriteHrefs: string[];
  recentVisits: RecentNavVisit[];
  navItems: PlatformNavItem[];
  collapsed: boolean;
  recentCollapsed: boolean;
  searchQuery?: string;
  onToggleRecent: () => void;
  onNavigate: () => void;
  isActive: (href: string) => boolean;
};

export function SidebarFavorites({
  favoriteHrefs,
  recentVisits,
  navItems,
  collapsed,
  recentCollapsed,
  searchQuery = "",
  onToggleRecent,
  onNavigate,
  isActive,
}: SidebarFavoritesProps) {
  const q = searchQuery.trim();

  const favorites = favoriteHrefs
    .map((href) => navItems.find((item) => item.href === href))
    .filter((item): item is PlatformNavItem => Boolean(item))
    .filter((item) => !q || navItemMatchesSearch(item, q));

  const recent = recentVisits
    .map((visit) => navItems.find((item) => item.href === visit.href))
    .filter((item): item is PlatformNavItem => Boolean(item))
    .filter((item) => !q || navItemMatchesSearch(item, q))
    .slice(0, 5);

  if (favorites.length === 0 && recent.length === 0) return null;
  if (collapsed && recent.length === 0) return null;

  return (
    <div className="space-y-3 border-t border-[var(--platform-border)] px-2 pt-3">
      {!collapsed && favorites.length > 0 && (
        <div>
          <p className="flex items-center gap-1.5 px-2 pb-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--platform-text-secondary)]">
            <Star className="size-3" aria-hidden />
            Favorites
          </p>
          <ul className="space-y-0.5">
            {favorites.map((item) => {
              const Icon = item.icon;
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={onNavigate}
                    data-active={isActive(item.href)}
                    className={cn("platform-sidebar-link py-2")}
                  >
                    <Icon className="size-4 shrink-0" aria-hidden />
                    <span className="truncate">{item.label}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      )}

          {recent.length > 0 && (
        <div>
          {!collapsed ? (
            <button
              type="button"
              onClick={onToggleRecent}
              aria-expanded={!recentCollapsed || Boolean(searchQuery.trim())}
              className={cn(
                "flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-[10px] font-semibold uppercase tracking-[0.12em] transition-colors",
                "text-[var(--platform-text-secondary)] hover:text-[var(--platform-text)]"
              )}
            >
              <Clock className="size-3.5 shrink-0" aria-hidden />
              <span className="min-w-0 flex-1 truncate">Recently visited</span>
              {recentCollapsed && !searchQuery.trim() ? (
                <ChevronRight className="size-3.5 shrink-0" aria-hidden />
              ) : (
                <ChevronDown className="size-3.5 shrink-0" aria-hidden />
              )}
            </button>
          ) : null}

          {(!recentCollapsed || collapsed || Boolean(searchQuery.trim())) && (
            <ul
              className={cn("space-y-0.5", !collapsed && !recentCollapsed && "mt-0.5")}
              role="group"
              aria-label="Recently visited"
            >
              {recent.map((item) => {
                const Icon = item.icon;
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      onClick={onNavigate}
                      data-active={isActive(item.href)}
                      className={cn("platform-sidebar-link py-2", collapsed && "justify-center px-2")}
                      title={collapsed ? item.label : undefined}
                    >
                      <Icon className="size-4 shrink-0" aria-hidden />
                      {!collapsed && <span className="truncate">{item.label}</span>}
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
