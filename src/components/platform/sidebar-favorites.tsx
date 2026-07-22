"use client";

import Link from "next/link";
import { Clock, Star } from "lucide-react";
import type { PlatformNavItem } from "@/lib/platform/nav";
import type { RecentNavVisit } from "@/lib/platform/sidebar-storage";
import { cn } from "@/lib/utils";

type SidebarFavoritesProps = {
  favoriteHrefs: string[];
  recentVisits: RecentNavVisit[];
  navItems: PlatformNavItem[];
  collapsed: boolean;
  onNavigate: () => void;
  isActive: (href: string) => boolean;
};

export function SidebarFavorites({
  favoriteHrefs,
  recentVisits,
  navItems,
  collapsed,
  onNavigate,
  isActive,
}: SidebarFavoritesProps) {
  if (collapsed) return null;

  const favorites = favoriteHrefs
    .map((href) => navItems.find((item) => item.href === href))
    .filter((item): item is PlatformNavItem => Boolean(item));

  const recent = recentVisits
    .map((visit) => navItems.find((item) => item.href === visit.href))
    .filter((item): item is PlatformNavItem => Boolean(item))
    .slice(0, 5);

  if (favorites.length === 0 && recent.length === 0) return null;

  return (
    <div className="space-y-3 border-t border-[var(--platform-border)] px-2 pt-3">
      {favorites.length > 0 && (
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
          <p className="flex items-center gap-1.5 px-2 pb-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--platform-text-secondary)]">
            <Clock className="size-3" aria-hidden />
            Recently visited
          </p>
          <ul className="space-y-0.5">
            {recent.map((item) => {
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
    </div>
  );
}
