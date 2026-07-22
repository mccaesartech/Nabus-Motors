"use client";

import { useState, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

type MobileSectionCollapseProps = {
  title: string;
  icon?: ReactNode;
  children: ReactNode;
  /** Desktop always shows content; mobile starts expanded unless false. */
  defaultOpen?: boolean;
  className?: string;
  headerExtra?: ReactNode;
};

/**
 * On phones, dense dashboard blocks can be collapsed so the viewport stays usable.
 * From `lg` up the toggle is hidden and content stays fully visible.
 */
export function MobileSectionCollapse({
  title,
  icon,
  children,
  defaultOpen = true,
  className,
  headerExtra,
}: MobileSectionCollapseProps) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <section className={cn("min-w-0 max-w-full", className)}>
      <div className="mb-2.5 flex min-w-0 items-center justify-between gap-2">
        <button
          type="button"
          className="flex min-w-0 flex-1 items-center gap-2 rounded-md text-left lg:pointer-events-none"
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
        >
          {icon}
          <h2 className="min-w-0 truncate text-sm font-semibold text-[var(--platform-text)]">
            {title}
          </h2>
          <ChevronDown
            className={cn(
              "ml-auto size-4 shrink-0 text-[var(--platform-text-secondary)] transition-transform duration-200 lg:hidden",
              open && "rotate-180"
            )}
            aria-hidden
          />
        </button>
        {headerExtra ? <div className="shrink-0">{headerExtra}</div> : null}
      </div>
      <div className={cn("min-w-0 max-w-full", !open && "max-lg:hidden")}>{children}</div>
    </section>
  );
}
