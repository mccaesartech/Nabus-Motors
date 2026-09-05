"use client";

import { SlidersHorizontal, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

type NabusFilterChip = {
  key: string;
  label: string;
  active?: boolean;
};

type NabusFilterBarProps = {
  chips?: NabusFilterChip[];
  onChipClick?: (key: string) => void;
  onClear?: () => void;
  onOpenFilters?: () => void;
  total?: number;
  sortControl?: React.ReactNode;
  viewToggle?: React.ReactNode;
  className?: string;
  activeCount?: number;
};

export function NabusFilterBar({
  chips = [],
  onChipClick,
  onClear,
  onOpenFilters,
  total,
  sortControl,
  viewToggle,
  className,
  activeCount = 0,
}: NabusFilterBarProps) {
  const activeChips = chips.filter((c) => c.active);

  return (
    <div className={cn("space-y-3", className)}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          {onOpenFilters ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-2 rounded-lg border-[var(--nabus-input-border)] lg:hidden"
              onClick={onOpenFilters}
            >
              <SlidersHorizontal className="size-4" />
              Filters
              {activeCount > 0 ? (
                <span className="flex size-5 items-center justify-center rounded-full bg-[var(--nabus-primary)] text-[10px] font-bold text-white">
                  {activeCount}
                </span>
              ) : null}
            </Button>
          ) : null}
          {typeof total === "number" ? (
            <p className="text-sm text-[var(--nabus-text-secondary)]">
              <span className="font-semibold tabular-nums text-[var(--nabus-charcoal)]">
                {total}
              </span>{" "}
              vehicles
            </p>
          ) : null}
        </div>
        <div className="flex items-center gap-2">
          {viewToggle}
          {sortControl}
        </div>
      </div>

      {chips.length > 0 ? (
        <div className="flex flex-wrap items-center gap-2">
          {chips.map((chip) => (
            <button
              key={chip.key}
              type="button"
              onClick={() => onChipClick?.(chip.key)}
              className={cn(
                "rounded-full border px-3 py-1.5 text-xs font-semibold transition-all duration-200",
                chip.active
                  ? "border-[var(--nabus-primary)] bg-[var(--nabus-red-soft)] text-[var(--nabus-primary)]"
                  : "border-[var(--nabus-border)] bg-[var(--nabus-surface)] text-[var(--nabus-text-secondary)] hover:border-[var(--nabus-primary)]/30 hover:text-[var(--nabus-charcoal)]"
              )}
            >
              {chip.label}
            </button>
          ))}
          {activeChips.length > 0 && onClear ? (
            <button
              type="button"
              onClick={onClear}
              className="inline-flex items-center gap-1 rounded-full px-2 py-1.5 text-xs font-semibold text-[var(--nabus-primary)] transition-colors hover:text-[var(--nabus-primary-hover)]"
            >
              <X className="size-3" />
              Clear all
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
