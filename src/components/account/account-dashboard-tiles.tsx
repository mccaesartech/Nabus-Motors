"use client";

import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export type AccountDashboardTile = {
  id: string;
  label: string;
  icon: LucideIcon;
  href: string;
  badge?: number;
  badgeLabel?: string;
};

type AccountDashboardTilesProps = {
  tiles: AccountDashboardTile[];
  className?: string;
};

export function AccountDashboardTiles({ tiles, className }: AccountDashboardTilesProps) {
  return (
    <nav
      aria-label="Account sections"
      className={cn("grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4", className)}
    >
      {tiles.map((tile) => {
        const Icon = tile.icon;
        return (
          <a
            key={tile.id}
            href={tile.href}
            className="group relative flex min-h-[5.5rem] flex-col items-center justify-center gap-2 rounded-xl border border-brand-purple/20 bg-card px-3 py-4 text-center shadow-luxury transition-all hover:border-brand-purple/40 hover:bg-brand-purple/5 hover:shadow-luxury-lg active:scale-[0.98] sm:min-h-[6.5rem] sm:px-4"
          >
            {tile.badge != null && tile.badge > 0 && (
              <span className="absolute right-2 top-2 flex min-w-5 items-center justify-center rounded-full bg-brand-purple px-1.5 py-0.5 text-[10px] font-bold text-white">
                {tile.badge}
                <span className="sr-only">{tile.badgeLabel ?? tile.label}</span>
              </span>
            )}
            <span className="flex size-11 items-center justify-center rounded-full bg-gradient-to-br from-brand-purple/15 to-brand-gold/15 text-brand-purple transition-colors group-hover:from-brand-purple/25 group-hover:to-brand-gold/20">
              <Icon className="size-5" strokeWidth={2} />
            </span>
            <span className="text-sm font-medium text-foreground">{tile.label}</span>
          </a>
        );
      })}
    </nav>
  );
}
