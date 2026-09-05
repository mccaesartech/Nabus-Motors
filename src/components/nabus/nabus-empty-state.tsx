import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";

type NabusEmptyStateProps = {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
};

export function NabusEmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: NabusEmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-start justify-center border-t border-[var(--nabus-border)] bg-transparent px-0 py-16 text-left",
        className
      )}
    >
      {Icon ? (
        <div className="mb-4 flex size-14 items-center justify-center rounded-2xl bg-[var(--nabus-red-soft)] text-[var(--nabus-primary)]">
          <Icon className="size-6" strokeWidth={1.75} />
        </div>
      ) : null}
      <h3 className="text-lg font-semibold tracking-tight text-[var(--nabus-charcoal)]">
        {title}
      </h3>
      {description ? (
        <p className="mt-2 max-w-md text-sm leading-relaxed text-[var(--nabus-text-secondary)]">
          {description}
        </p>
      ) : null}
      {action ? <div className="mt-6">{action}</div> : null}
    </div>
  );
}
