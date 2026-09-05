"use client";

import { SlidersHorizontal, X } from "lucide-react";
import { InventoryFilters } from "@/components/inventory/inventory-filters";
import { useLockBodyScroll } from "@/hooks/use-lock-body-scroll";
import { cn } from "@/lib/utils";

type NabusFilterSheetProps = {
  open: boolean;
  onClose: () => void;
  side?: "left" | "bottom";
};

export function NabusFilterSheet({ open, onClose, side = "left" }: NabusFilterSheetProps) {
  useLockBodyScroll(open);

  return (
    <>
      <button
        type="button"
        aria-label="Close filters"
        tabIndex={open ? 0 : -1}
        inert={!open ? true : undefined}
        className={cn(
          "fixed inset-0 z-40 bg-[var(--nabus-graphite)]/40 transition-opacity duration-200",
          open ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0"
        )}
        onClick={onClose}
      />

      <aside
        aria-label="Filters"
        inert={!open ? true : undefined}
        className={cn(
          "fixed z-50 flex flex-col bg-[var(--nabus-paper)] transition-transform duration-250 ease-out",
          side === "left"
            ? cn(
                "inset-y-0 left-0 w-[min(100vw-2rem,22rem)] border-r border-[var(--nabus-border)]",
                open ? "translate-x-0" : "-translate-x-full"
              )
            : cn(
                "inset-x-0 bottom-0 max-h-[85dvh] rounded-t-lg border-t border-[var(--nabus-border)]",
                open ? "translate-y-0" : "translate-y-full"
              )
        )}
      >
        <div className="flex items-center justify-between border-b border-[var(--nabus-border)] px-4 py-3">
          <div className="flex items-center gap-2">
            <SlidersHorizontal className="size-4 text-[var(--nabus-wine)]" />
            <span className="text-sm font-semibold uppercase tracking-wide text-[var(--nabus-graphite)]">
              Filter & Sort
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex min-h-9 min-w-9 items-center justify-center"
            aria-label="Close"
          >
            <X className="size-4" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-4">
          <InventoryFilters onApplied={onClose} />
        </div>
      </aside>
    </>
  );
}

/** Trigger button for filter sheet */
export function NabusFilterTrigger({
  onClick,
  count,
  className,
}: {
  onClick: () => void;
  count?: number;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-2 border border-[var(--nabus-border)] px-4 py-2 text-xs font-semibold uppercase tracking-wide text-[var(--nabus-graphite)] transition-colors duration-200 hover:border-[var(--nabus-wine)] hover:text-[var(--nabus-wine)]",
        className
      )}
    >
      <SlidersHorizontal className="size-3.5" />
      Filter
      {count && count > 0 ? (
        <span className="bg-[var(--nabus-wine)] px-1.5 py-0.5 text-[10px] text-white">{count}</span>
      ) : null}
    </button>
  );
}
