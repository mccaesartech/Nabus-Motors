"use client";

import { cn } from "@/lib/utils";

type NotificationCountBadgeProps = {
  count: number;
  className?: string;
  max?: number;
};

export function NotificationCountBadge({
  count,
  className,
  max = 99,
}: NotificationCountBadgeProps) {
  if (count <= 0) return null;

  const label = count > max ? `${max}+` : String(count);

  return (
    <span
      className={cn(
        "absolute -right-1 -top-1 flex min-w-4 items-center justify-center rounded-full bg-brand-cta-gold px-1 text-[10px] font-semibold leading-4 text-white",
        className
      )}
      aria-hidden
    >
      {label}
    </span>
  );
}
