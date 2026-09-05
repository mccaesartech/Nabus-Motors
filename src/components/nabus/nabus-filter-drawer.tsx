"use client";

import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useLockBodyScroll } from "@/hooks/use-lock-body-scroll";

type NabusFilterDrawerProps = {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  className?: string;
};

export function NabusFilterDrawer({
  open,
  onClose,
  title = "Filters",
  children,
  footer,
  className,
}: NabusFilterDrawerProps) {
  useLockBodyScroll(open);

  return (
    <>
      <button
        type="button"
        aria-label="Close filters"
        tabIndex={open ? 0 : -1}
        inert={!open ? true : undefined}
        className={cn(
          "fixed inset-0 z-40 bg-[var(--nabus-charcoal)]/40 transition-opacity duration-200 lg:hidden",
          open ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0"
        )}
        onClick={onClose}
      />
      <aside
        aria-label={title}
        inert={!open ? true : undefined}
        className={cn(
          "fixed inset-y-0 right-0 z-50 flex w-[min(100dvw-2rem,22rem)] flex-col border-l border-[var(--nabus-border)] bg-[var(--nabus-surface)] shadow-xl transition-transform duration-200 ease-out lg:hidden",
          open ? "translate-x-0" : "pointer-events-none translate-x-full",
          className
        )}
      >
        <div className="flex items-center justify-between border-b border-[var(--nabus-border)] px-4 py-3">
          <h2 className="text-sm font-bold text-[var(--nabus-charcoal)]">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex min-h-10 min-w-10 items-center justify-center rounded-lg"
            aria-label="Close filters"
          >
            <X className="size-4" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-4">{children}</div>
        {footer ? (
          <div className="border-t border-[var(--nabus-border)] p-4">{footer}</div>
        ) : (
          <div className="border-t border-[var(--nabus-border)] p-4">
            <Button
              type="button"
              className="w-full rounded-lg bg-[var(--nabus-primary)]"
              onClick={onClose}
            >
              Apply Filters
            </Button>
          </div>
        )}
      </aside>
    </>
  );
}
