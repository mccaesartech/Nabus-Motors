"use client";

import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { BarChart3 } from "lucide-react";
import { cn } from "@/lib/utils";

type EmptyStateProps = {
  icon?: LucideIcon;
  title: string;
  description: string;
  actionLabel?: string;
  actionHref?: string;
  compact?: boolean;
  className?: string;
};

export function EmptyState({
  icon: Icon = BarChart3,
  title,
  description,
  actionLabel,
  actionHref,
  compact,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center text-center",
        compact ? "px-4 py-6" : "px-6 py-10",
        className
      )}
    >
      <span
        className="mb-3 flex size-12 items-center justify-center rounded-xl bg-[rgba(139,92,246,0.08)] text-[var(--platform-accent)]"
        aria-hidden
      >
        <Icon className="size-6" />
      </span>
      <p className="text-sm font-medium text-[var(--platform-text)]">{title}</p>
      <p className="mt-1 max-w-xs text-xs leading-relaxed text-[var(--platform-text-secondary)]">
        {description}
      </p>
      {actionLabel && actionHref && (
        <Link
          href={actionHref}
          className="mt-4 inline-flex items-center rounded-md bg-[rgba(139,92,246,0.1)] px-3 py-1.5 text-xs font-semibold text-[var(--platform-accent)] transition-colors hover:bg-[rgba(139,92,246,0.18)]"
        >
          {actionLabel}
        </Link>
      )}
    </div>
  );
}
