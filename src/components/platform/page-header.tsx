import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { BackButton } from "@/components/platform/back-button";

type PageHeaderProps = {
  title: string;
  description?: string;
  actions?: ReactNode;
  breadcrumb?: string;
  showBack?: boolean;
  backFallbackHref?: string;
  backLabel?: string;
};

export function PageHeader({
  title,
  description,
  actions,
  breadcrumb,
  showBack = true,
  backFallbackHref,
  backLabel,
}: PageHeaderProps) {
  return (
    <div className="no-print mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0">
        {showBack && (
          <BackButton
            fallbackHref={backFallbackHref}
            label={backLabel}
            className="mb-3"
          />
        )}
        {breadcrumb && (
          <p className="mb-1 text-xs font-medium uppercase tracking-wider text-[var(--platform-text-secondary)]">
            {breadcrumb}
          </p>
        )}
        <h1 className="text-xl font-bold tracking-tight text-[var(--platform-text)] sm:text-2xl">
          {title}
        </h1>
        {description && (
          <p className="mt-1 max-w-2xl text-sm text-[var(--platform-text-secondary)]">
            {description}
          </p>
        )}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

type StatCardProps = {
  label: string;
  value: string | number;
  change?: string;
  changeTone?: "positive" | "negative" | "neutral";
  icon?: ReactNode;
  onClick?: () => void;
};

export function StatCard({
  label,
  value,
  change,
  changeTone = "neutral",
  icon,
  onClick,
}: StatCardProps) {
  const Wrapper = onClick ? "button" : "div";
  const changeColor =
    changeTone === "positive"
      ? "text-[var(--platform-success)]"
      : changeTone === "negative"
        ? "text-[var(--platform-error)]"
        : "text-[var(--platform-text-secondary)]";

  return (
    <Wrapper
      type={onClick ? "button" : undefined}
      onClick={onClick}
      className={cn(
        "platform-stat-card text-left",
        onClick && "cursor-pointer"
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <p className="text-xs font-medium uppercase tracking-wide text-[var(--platform-text-secondary)]">
          {label}
        </p>
        {icon && (
          <span className="flex size-8 items-center justify-center rounded-md bg-[rgba(37,99,235,0.12)] text-[var(--platform-accent)]">
            {icon}
          </span>
        )}
      </div>
      <p className="mt-3 text-2xl font-semibold tabular-nums text-[var(--platform-text)]">
        {value}
      </p>
      {change && <p className={cn("mt-1 text-xs", changeColor)}>{change}</p>}
    </Wrapper>
  );
}
