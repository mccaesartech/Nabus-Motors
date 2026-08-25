"use client";

import Link from "next/link";
import { useEffect } from "react";
import { ArrowRightLeft, X } from "lucide-react";
import { usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";
import { useCompare } from "@/hooks/use-compare";
import { useGarageVehicles } from "@/hooks/use-garage";
import { ROUTES, isAutoDivisionPath } from "@/lib/routes";
import { formatVehicleName } from "@/lib/format";

export function CompareFloatingBar() {
  const pathname = usePathname() ?? "";
  const { compareIds, compareCount, removeFromCompare, clearCompare } = useCompare();
  const { vehicles } = useGarageVehicles(compareIds, compareIds);

  const showBar =
    isAutoDivisionPath(pathname) &&
    pathname !== ROUTES.auto.compare &&
    compareCount > 0;

  useEffect(() => {
    const root = document.documentElement;
    if (showBar) {
      root.dataset.compareBar = "open";
      root.style.setProperty("--compare-bar-height", "4.5rem");
    } else {
      delete root.dataset.compareBar;
      root.style.setProperty("--compare-bar-height", "0px");
    }
    return () => {
      delete root.dataset.compareBar;
      root.style.setProperty("--compare-bar-height", "0px");
    };
  }, [showBar]);

  if (!showBar) return null;

  return (
    <div
      role="region"
      aria-label="Vehicle compare tray"
      className="fixed bottom-0 left-0 right-0 z-40 border-t border-border bg-background/95 px-4 py-3 pb-[calc(0.75rem+env(safe-area-inset-bottom,0px))] shadow-luxury-lg backdrop-blur-sm"
    >
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-3 sm:gap-4">
        <div className="flex items-center gap-2 text-sm font-medium">
          <ArrowRightLeft className="size-4 text-brand-purple" />
          Compare ({compareCount})
        </div>

        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
          {compareIds.map((id) => {
            const vehicle = vehicles.find((v) => v.id === id || v.slug === id);
            return (
              <span
                key={id}
                className="inline-flex max-w-[min(180px,45vw)] items-center gap-1 truncate rounded-md border border-border bg-muted/50 px-2 py-1.5 text-xs"
              >
                <span className="truncate">
                  {vehicle ? formatVehicleName(vehicle) : id}
                </span>
                {vehicle && (
                  <button
                    type="button"
                    onClick={() => removeFromCompare(vehicle)}
                    className="inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:text-foreground"
                    aria-label={`Remove ${formatVehicleName(vehicle)} from compare`}
                  >
                    <X className="size-4" />
                  </button>
                )}
              </span>
            );
          })}
        </div>

        <div className="flex w-full shrink-0 items-center gap-2 sm:w-auto">
          <Button
            variant="ghost"
            size="sm"
            onClick={clearCompare}
            className="min-h-11 flex-1 text-muted-foreground sm:flex-none"
          >
            Clear
          </Button>
          <Button
            size="sm"
            className="min-h-11 flex-1 sm:flex-none"
            render={<Link href={ROUTES.auto.compare} />}
          >
            Compare Now
          </Button>
        </div>
      </div>
    </div>
  );
}
