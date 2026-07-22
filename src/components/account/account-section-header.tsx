import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type AccountSectionHeaderProps = {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
};

export function AccountSectionHeader({
  icon,
  title,
  description,
  action,
  className,
}: AccountSectionHeaderProps) {
  return (
    <div className={cn("flex flex-wrap items-start justify-between gap-3", className)}>
      <div className="flex items-start gap-3">
        {icon ? (
          <div className="flex size-11 shrink-0 items-center justify-center rounded-xl border border-brand-purple/20 bg-gradient-to-br from-brand-purple/10 to-brand-gold/10 text-brand-purple shadow-sm">
            {icon}
          </div>
        ) : null}
        <div>
          <h2 className="text-lg font-semibold text-foreground">{title}</h2>
          {description && (
            <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>
          )}
        </div>
      </div>
      {action}
    </div>
  );
}
