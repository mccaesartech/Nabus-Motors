import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";

type NabusDashboardCardProps = {
  title: string;
  value: string | number;
  description?: string;
  icon?: LucideIcon;
  trend?: { value: string; positive?: boolean };
  className?: string;
};

export function NabusDashboardCard({
  title,
  value,
  description,
  icon: Icon,
  trend,
  className,
}: NabusDashboardCardProps) {
  return (
    <div
      className={cn(
        "rounded-xl border border-[var(--nabus-border)] bg-[var(--nabus-surface)] p-5",
        className
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-medium text-[var(--nabus-text-secondary)]">{title}</p>
          <p className="mt-1 text-2xl font-bold tabular-nums text-[var(--nabus-charcoal)]">
            {value}
          </p>
          {description ? (
            <p className="mt-1 text-xs text-[var(--nabus-text-secondary)]">{description}</p>
          ) : null}
          {trend ? (
            <p
              className={cn(
                "mt-2 text-xs font-semibold",
                trend.positive ? "text-green-600" : "text-[var(--nabus-text-secondary)]"
              )}
            >
              {trend.value}
            </p>
          ) : null}
        </div>
        {Icon ? (
          <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-[var(--nabus-red-soft)] text-[var(--nabus-primary)]">
            <Icon className="size-5" strokeWidth={1.75} />
          </span>
        ) : null}
      </div>
    </div>
  );
}
